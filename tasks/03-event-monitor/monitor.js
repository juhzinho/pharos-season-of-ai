#!/usr/bin/env node
import { isAddress, parseUnits } from "viem";
import { connect, isTransient, CHAIN_MCP_URL } from "../../lib/mcp.js";
import { explorerTx, formatAmount, formatInteger, labeled } from "../../lib/format.js";
import { resolveToken } from "../../lib/tokens.js";
import { fetchTransfers, latestBlock, MAX_WINDOW, readTokenInfo, TRANSFER_TOPIC, transferKey } from "../../lib/transfers.js";

const USAGE = `Usage: node tasks/03-event-monitor/monitor.js [USDC|WPROS|<token address>] [options]

Watches ERC20 Transfer events through Chain MCP and prints each new one as it happens.

Options:
  --min <amount>       only show transfers ≥ amount, in token units (default 0)
  --interval <s>       seconds between checks in live mode (default 5, minimum 2)
  --lookback <blocks>  initial history, 0 to ${MAX_WINDOW} blocks (default 200)
  --once               scan the history, print a summary and exit
  --links              print the explorer link of each transaction`;

const LANG = "en";
const HEARTBEAT_MS = 60_000;
// Each live cycle re-reads this many already-seen blocks in case the node indexed their logs late; `reported` drops the repeats.
const OVERLAP = 5;

function fail(message) {
  console.log(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { token: undefined, min: "0", interval: 5, lookback: 200, once: false, links: false };
  const numeric = (flag, value) => {
    if (value === undefined || value.startsWith("--") || !/^\d+(\.\d+)?$/.test(value)) fail(`${flag} needs a number.`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--min") opts.min = numeric(a, argv[++i]);
    else if (a === "--interval") opts.interval = Number(numeric(a, argv[++i]));
    else if (a === "--lookback") opts.lookback = Number(numeric(a, argv[++i]));
    else if (a === "--once") opts.once = true;
    else if (a === "--links") opts.links = true;
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (a.startsWith("--")) fail(`Unknown option: ${a}`);
    else if (opts.token) fail(`Unexpected argument: ${a}`);
    else opts.token = a;
  }
  if (opts.interval < 2) fail("--interval must be at least 2 seconds.");
  if (!Number.isInteger(opts.lookback) || opts.lookback > MAX_WINDOW) fail(`--lookback must be an integer from 0 to ${MAX_WINDOW}.`);
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const token = resolveToken(opts.token);
if (!isAddress(token)) fail(`Invalid token: ${opts.token}`);

let client;
try {
  client = await connect(CHAIN_MCP_URL, "pharos-event-monitor");
} catch (e) {
  console.error(`Error: could not connect to Chain MCP (${e.message})`);
  process.exit(1);
}

const [{ decimals, symbol }, initialHead] = await Promise.all([readTokenInfo(client, token), latestBlock(client)]).catch((e) => {
  console.error(
    isTransient(e)
      ? `Error: Chain MCP is not responding right now (${e.message}). Try again in a few seconds.`
      : `Error: ${token} did not respond as an ERC20 token (${e.shortMessage ?? e.message})`
  );
  process.exit(1);
});

const minRaw = parseUnits(opts.min, decimals);
const stats = { seen: 0, alerts: 0, volume: 0n, skipped: 0 };
const reported = new Map(); // event key -> block
let lastOutput = Date.now();

async function scan(fromBlock, toBlock, live) {
  const { transfers, skipped } = await fetchTransfers(client, token, fromBlock, toBlock);
  stats.skipped += skipped;
  for (const t of transfers) {
    const key = transferKey(t);
    if (reported.has(key)) continue;
    reported.set(key, t.block);
    stats.seen++;
    stats.volume += t.value;
    if (t.value < minRaw) continue;
    stats.alerts++;
    lastOutput = Date.now();
    console.log(
      `${live ? "NEW " : ""}[block ${formatInteger(t.block, LANG)}] ${t.kind.toUpperCase()} ${formatAmount(t.value, decimals, 6, LANG)} ${symbol}` +
        `  from ${labeled(t.from, {}, LANG)} → to ${labeled(t.to, {}, LANG)}` +
        `\n    tx ${opts.links ? explorerTx(t.tx) : t.tx}`
    );
  }
  for (const [key, block] of reported) if (block < toBlock - OVERLAP * 2) reported.delete(key);
}

function summary() {
  console.log(
    `\nSummary: ${stats.seen} transfers seen, ${stats.alerts} with amount ≥ ${opts.min} ${symbol}, ` +
      `total volume ${formatAmount(stats.volume, decimals, 2, LANG)} ${symbol}` +
      (stats.skipped ? ` (${stats.skipped} non-ERC20 events skipped)` : "")
  );
}

console.log(`Watching Transfer events of ${symbol} (${token}) via Chain MCP`);
console.log(`get_logs filter: address ${token}, topic0 ${TRANSFER_TOPIC} (Transfer(address,address,uint256))`);
console.log(`Filter: amount ≥ ${opts.min} ${symbol} | interval ${opts.interval}s | initial history ${opts.lookback} blocks\n`);

let head = initialHead;
const firstBlock = Math.max(0, head - opts.lookback + 1);
try {
  if (opts.lookback > 0) await scan(firstBlock, head, false);
} catch (e) {
  console.error(`Error reading history: ${e.message}`);
  process.exit(1);
}

if (opts.once) {
  if (opts.lookback > 0) console.log(`\nBlocks ${formatInteger(firstBlock, LANG)} to ${formatInteger(head, LANG)} checked.`);
  summary();
  await client.close().catch(() => {});
  process.exit(0);
}

console.log(`\n— history loaded (up to block ${formatInteger(head, LANG)}). Watching for new events… (Ctrl+C to stop)\n`);
lastOutput = Date.now();
process.on("SIGINT", async () => {
  summary();
  await client.close().catch(() => {});
  process.exit(0);
});

let failures = 0;
for (;;) {
  await new Promise((r) => setTimeout(r, opts.interval * 1000));
  try {
    const next = await latestBlock(client);
    if (next > head) {
      await scan(Math.max(firstBlock, head + 1 - OVERLAP), next, true);
      head = next;
    }
    failures = 0;
    if (Date.now() - lastOutput >= HEARTBEAT_MS) {
      console.log(`  (still watching — block ${formatInteger(head, LANG)}, no new matching transfers in the last minute)`);
      lastOutput = Date.now();
    }
  } catch (e) {
    failures++;
    console.error(`Warning: ${e.message} — retrying next cycle (${failures} failure(s) in a row)`);
  }
}
