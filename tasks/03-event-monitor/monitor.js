#!/usr/bin/env node
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  isAddress,
  toEventSelector,
} from "viem";
import { connect, callJson, CHAIN_MCP_URL } from "../../lib/mcp.js";
import { resolveToken } from "../../lib/tokens.js";

const TRANSFER_TOPIC = toEventSelector("Transfer(address,address,uint256)");
const MAX_WINDOW = 1000; // get_logs rejects ranges larger than 1000 blocks

function parseArgs(argv) {
  const opts = { token: undefined, min: 0, interval: 5, lookback: 200, once: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--min") opts.min = Number(argv[++i]);
    else if (a === "--interval") opts.interval = Number(argv[++i]);
    else if (a === "--lookback") opts.lookback = Math.min(Number(argv[++i]), MAX_WINDOW);
    else if (a === "--once") opts.once = true;
    else opts.token = a;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const token = resolveToken(opts.token);
if (!isAddress(token)) {
  console.log(`Uso: node tasks/03-event-monitor/monitor.js [USDC|WPROS|<token>] [--min <valor>] [--interval <s>] [--lookback <blocos>] [--once]`);
  process.exit(1);
}

const client = await connect(CHAIN_MCP_URL, "pharos-event-monitor");
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function readToken(functionName) {
  const data = encodeFunctionData({ abi: erc20Abi, functionName });
  const { result } = await callJson(client, "eth_call", { transaction: { to: token, data } });
  return decodeFunctionResult({ abi: erc20Abi, functionName, data: result });
}

async function latestBlock() {
  return Number((await callJson(client, "get_block_number")).blockNumber);
}

const [decimals, symbol] = await Promise.all([readToken("decimals"), readToken("symbol")]);

let stats = { seen: 0, alerts: 0, volume: 0 };

async function scan(fromBlock, toBlock) {
  for (let start = fromBlock; start <= toBlock; start += MAX_WINDOW) {
    const end = Math.min(start + MAX_WINDOW - 1, toBlock);
    const logs = await callJson(client, "get_logs", {
      address: token,
      topics: [TRANSFER_TOPIC],
      fromBlock: start,
      toBlock: end,
    });
    for (const log of logs) {
      const { args } = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      const amount = Number(formatUnits(args.value, decimals));
      stats.seen++;
      stats.volume += amount;
      if (amount < opts.min) continue;
      stats.alerts++;
      const block = Number(log.blockNumber);
      console.log(
        `[bloco ${block}] Transfer ${amount.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${symbol}  ` +
          `${short(args.from)} → ${short(args.to)}  tx ${short(log.transactionHash)}`
      );
    }
  }
}

console.log(`Monitorando eventos Transfer de ${symbol} (${token}) via Chain MCP`);
console.log(`Filtro: valor ≥ ${opts.min} ${symbol} | intervalo ${opts.interval}s | histórico inicial ${opts.lookback} blocos\n`);

let head = await latestBlock();
await scan(Math.max(0, head - opts.lookback + 1), head);

const summary = () =>
  console.log(
    `\nResumo: ${stats.seen} transfers vistos, ${stats.alerts} acima do filtro, volume ${stats.volume.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${symbol}`
  );

if (opts.once) {
  summary();
  await client.close();
} else {
  console.log(`\n— histórico carregado (até o bloco ${head}). Aguardando novos eventos… (Ctrl+C para sair)\n`);
  process.on("SIGINT", async () => {
    summary();
    await client.close();
    process.exit(0);
  });
  for (;;) {
    await new Promise((r) => setTimeout(r, opts.interval * 1000));
    try {
      const next = await latestBlock();
      if (next > head) {
        await scan(head + 1, next);
        head = next;
      }
    } catch (e) {
      console.error(`Aviso: ${e.message} — tentando de novo no próximo ciclo`);
    }
  }
}
