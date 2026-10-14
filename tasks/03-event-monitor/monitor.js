#!/usr/bin/env node
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  isAddress,
  parseUnits,
  toEventSelector,
} from "viem";
import { connect, callJson, isTransient, CHAIN_MCP_URL } from "../../lib/mcp.js";
import { explorerTx, formatAmount, formatInteger, labeled, short } from "../../lib/format.js";
import { resolveToken } from "../../lib/tokens.js";

const TRANSFER_TOPIC = toEventSelector("Transfer(address,address,uint256)");
const MAX_WINDOW = 1000; // get_logs rejects ranges larger than 1000 blocks

const USAGE = `Uso: node tasks/03-event-monitor/monitor.js [USDC|WPROS|<token>] [opções]

Opções:
  --min <valor>        só mostra transfers com valor ≥ valor (padrão 0)
  --interval <s>       segundos entre verificações no modo ao vivo (padrão 5, mínimo 2)
  --lookback <blocos>  histórico inicial, de 0 a ${MAX_WINDOW} blocos (padrão 200)
  --once               varre o histórico, mostra o resumo e sai
  --links              mostra o link do explorer de cada transação`;

function fail(message) {
  console.log(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { token: undefined, min: "0", interval: 5, lookback: 200, once: false, links: false };
  const numeric = (flag, value) => {
    if (value === undefined || value.startsWith("--") || !/^\d+(\.\d+)?$/.test(value)) fail(`${flag} precisa de um número.`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--min") opts.min = numeric(a, argv[++i]);
    else if (a === "--interval") opts.interval = Number(numeric(a, argv[++i]));
    else if (a === "--lookback") opts.lookback = Number(numeric(a, argv[++i]));
    else if (a === "--once") opts.once = true;
    else if (a === "--links") opts.links = true;
    else if (a === "--help") {
      console.log(USAGE);
      process.exit(0);
    } else if (a.startsWith("--")) fail(`Opção desconhecida: ${a}`);
    else if (opts.token) fail(`Argumento a mais: ${a}`);
    else opts.token = a;
  }
  if (opts.interval < 2) fail("--interval mínimo é 2 segundos.");
  if (!Number.isInteger(opts.lookback) || opts.lookback > MAX_WINDOW) fail(`--lookback precisa ser um inteiro de 0 a ${MAX_WINDOW}.`);
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const token = resolveToken(opts.token);
if (!isAddress(token)) fail(`Token inválido: ${opts.token}`);

let client;
try {
  client = await connect(CHAIN_MCP_URL, "pharos-event-monitor");
} catch (e) {
  console.error(`Erro: não foi possível conectar ao Chain MCP (${e.message})`);
  process.exit(1);
}

async function readToken(functionName) {
  const data = encodeFunctionData({ abi: erc20Abi, functionName });
  const { result } = await callJson(client, "eth_call", { transaction: { to: token, data } });
  return decodeFunctionResult({ abi: erc20Abi, functionName, data: result });
}

async function latestBlock() {
  return Number((await callJson(client, "get_block_number")).blockNumber);
}

const [decimals, symbol, initialHead] = await Promise.all([readToken("decimals"), readToken("symbol"), latestBlock()]).catch(
  (e) => {
    console.error(
      isTransient(e)
        ? `Erro: o Chain MCP não está respondendo agora (${e.message}). Tente de novo em alguns segundos.`
        : `Erro: ${token} não respondeu como um token ERC20 (${e.shortMessage ?? e.message})`
    );
    process.exit(1);
  }
);

const minRaw = parseUnits(opts.min, decimals);
const stats = { seen: 0, alerts: 0, volume: 0n, skipped: 0 };

async function scan(fromBlock, toBlock) {
  for (let start = fromBlock; start <= toBlock; start += MAX_WINDOW) {
    const end = Math.min(start + MAX_WINDOW - 1, toBlock);
    const logs = await callJson(client, "get_logs", { address: token, topics: [TRANSFER_TOPIC], fromBlock: start, toBlock: end });
    logs.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.logIndex) - Number(b.logIndex));
    for (const log of logs) {
      let args;
      try {
        ({ args } = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", data: log.data, topics: log.topics }));
      } catch {
        stats.skipped++; // same topic, different layout (e.g. an NFT Transfer)
        continue;
      }
      stats.seen++;
      stats.volume += args.value;
      if (args.value < minRaw) continue;
      stats.alerts++;
      const kind = /^0x0{40}$/.test(args.from) ? "MINT    " : /^0x0{40}$/.test(args.to) ? "BURN    " : "Transfer";
      console.log(
        `[bloco ${formatInteger(log.blockNumber)}] ${kind} ${formatAmount(args.value, decimals, 6)} ${symbol}  ` +
          `${labeled(args.from)} → ${labeled(args.to)}  tx ${short(log.transactionHash)}` +
          (opts.links ? `\n    ${explorerTx(log.transactionHash)}` : "")
      );
    }
  }
}

function summary() {
  console.log(
    `\nResumo: ${stats.seen} transfers vistos, ${stats.alerts} com valor ≥ ${opts.min} ${symbol}, ` +
      `volume total ${formatAmount(stats.volume, decimals)} ${symbol}` +
      (stats.skipped ? ` (${stats.skipped} eventos ignorados por não serem ERC20)` : "")
  );
}

console.log(`Monitorando eventos Transfer de ${symbol} (${token}) via Chain MCP`);
console.log(`Filtro: valor ≥ ${opts.min} ${symbol} | intervalo ${opts.interval}s | histórico inicial ${opts.lookback} blocos\n`);

let head = initialHead;
try {
  if (opts.lookback > 0) await scan(Math.max(0, head - opts.lookback + 1), head);
} catch (e) {
  console.error(`Erro ao ler o histórico: ${e.message}`);
  process.exit(1);
}

if (opts.once) {
  if (opts.lookback > 0) {
    console.log(`\nBlocos ${formatInteger(Math.max(0, head - opts.lookback + 1))} a ${formatInteger(head)} verificados.`);
  }
  summary();
  await client.close().catch(() => {});
  process.exit(0);
}

console.log(`\n— histórico carregado (até o bloco ${formatInteger(head)}). Aguardando novos eventos… (Ctrl+C para sair)\n`);
process.on("SIGINT", async () => {
  summary();
  await client.close().catch(() => {});
  process.exit(0);
});

let failures = 0;
for (;;) {
  await new Promise((r) => setTimeout(r, opts.interval * 1000));
  try {
    const next = await latestBlock();
    if (next > head) {
      await scan(head + 1, next);
      head = next;
    }
    failures = 0;
  } catch (e) {
    failures++;
    console.error(`Aviso: ${e.message} — tentando de novo no próximo ciclo (${failures} falha(s) seguidas)`);
  }
}
