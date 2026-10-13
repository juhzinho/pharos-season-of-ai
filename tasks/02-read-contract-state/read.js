#!/usr/bin/env node
import { decodeFunctionResult, encodeFunctionData, erc20Abi, formatUnits, isAddress } from "viem";
import { connect, callJson, CHAIN_MCP_URL } from "../../lib/mcp.js";
import { resolveToken } from "../../lib/tokens.js";

const [tokenArg, holder] = process.argv.slice(2);
const token = resolveToken(tokenArg);

if (!isAddress(token) || (holder && !isAddress(holder))) {
  console.log(`Uso: node tasks/02-read-contract-state/read.js [USDC|WPROS|<endereço do token>] [<endereço da carteira>]`);
  process.exit(1);
}

const client = await connect(CHAIN_MCP_URL, "pharos-read-contract-state");

async function read(functionName, args = []) {
  const data = encodeFunctionData({ abi: erc20Abi, functionName, args });
  const { result } = await callJson(client, "eth_call", { transaction: { to: token, data } });
  return decodeFunctionResult({ abi: erc20Abi, functionName, data: result });
}

try {
  const chain = await callJson(client, "get_chain_info");
  const code = await callJson(client, "get_code", { address: token });
  const bytecode = typeof code === "string" ? code : code.code ?? code.result ?? "";
  if (!bytecode || bytecode === "0x") throw new Error(`Não há contrato em ${token} nesta rede.`);

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    read("name"),
    read("symbol"),
    read("decimals"),
    read("totalSupply"),
  ]);

  console.log(`Rede:          Pharos (chain ${chain.chainId ?? "?"}), bloco ${chain.latestBlock ?? chain.blockNumber ?? "?"}`);
  console.log(`Contrato:      ${token}`);
  console.log(`Bytecode:      ${(bytecode.length - 2) / 2} bytes`);
  console.log(`Nome:          ${name}`);
  console.log(`Símbolo:       ${symbol}`);
  console.log(`Decimais:      ${decimals}`);
  console.log(`Total supply:  ${Number(formatUnits(totalSupply, decimals)).toLocaleString("pt-BR")} ${symbol}`);

  if (holder) {
    const balance = await read("balanceOf", [holder]);
    const native = await callJson(client, "get_balance", { address: holder });
    console.log(`\nCarteira:      ${holder}`);
    console.log(`Saldo ${symbol}:`.padEnd(15) + `${formatUnits(balance, decimals)} ${symbol}`);
    console.log(`Saldo PROS:    ${native.balance} ${native.symbol}`);
  }
} catch (e) {
  console.error(`Erro: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
