import { spawn } from "node:child_process";
import { startFakeLlm } from "./fake-llm.js";

const DOCS = "tasks/01-doc-search-cli/cli.js";
const READ = "tasks/02-read-contract-state/read.js";
const AGENT = "tasks/02-read-contract-state/agent.js";
const AGENT_AI = "tasks/02-read-contract-state/agent-ai.js";
const MONITOR = "tasks/03-event-monitor/monitor.js";
const USDC = "0xc879c018db60520f4355c26ed1a6d572cdac1815";
const USDC_OWNER = "0x9f8ea09770dc38fc61f5a62031b3be0526d54d92";
const WPROS = "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0";
const DEAD = "0x000000000000000000000000000000000000dEaD";

const fake = await startFakeLlm();
const FAKE_ENV = { LLM_BASE_URL: `http://127.0.0.1:${fake.address().port}`, LLM_MODEL: "fake", PHAROS_ENV_FILE: "nenhum.env" };

const CASES = [
  // Tarefa 1 — Doc-Search CLI
  { name: "docs: ajuda sem argumentos", args: [DOCS], code: 0, expect: /Uso:/ },
  { name: "docs: --help", args: [DOCS, "--help"], code: 0, expect: /Exemplos:/ },
  { name: "docs: search", args: [DOCS, "search", "pacific mainnet rpc", "--limit", "3"], code: 0, expect: /^1\. [\s\S]*docs\.pharos\.xyz/m },
  { name: "docs: search respeita --limit", args: [DOCS, "links", "token", "--limit", "2"], code: 0, expect: /^2\. /m, reject: /^3\. /m },
  { name: "docs: links", args: [DOCS, "links", "skill engine"], code: 0, expect: /^1\. .+\n\s+https:/m },
  { name: "docs: ask", args: [DOCS, "ask", "What is the chain ID of Pharos mainnet?"], code: 0, expect: /1672/ },
  { name: "docs: ask com --goal", args: [DOCS, "ask", "Qual o RPC da mainnet?", "--goal", "configurar minha carteira"], code: 0, expect: /rpc\.pharos\.xyz/ },
  { name: "docs: page por URL", args: [DOCS, "page", "https://docs.pharos.xyz/getting-started/token-registry"], code: 0, expect: new RegExp(USDC, "i") },
  { name: "docs: page por caminho", args: [DOCS, "page", "/getting-started/network/pacific-mainnet"], code: 0, expect: /1672/ },
  { name: "docs: page de outro site", args: [DOCS, "page", "https://google.com"], code: 1, expect: /só abre páginas/ },
  { name: "docs: comando inválido", args: [DOCS, "xyz", "abc"], code: 1, expect: /Comando desconhecido/ },
  { name: "docs: comando sem texto", args: [DOCS, "search"], code: 1, expect: /precisa de um texto/ },
  { name: "docs: --limit inválido", args: [DOCS, "search", "rpc", "--limit", "abc"], code: 1, expect: /--limit precisa/ },
  { name: "docs: opção desconhecida", args: [DOCS, "search", "rpc", "--xpto"], code: 1, expect: /Opção desconhecida/ },
  { name: "docs: termo sem resultado", args: [DOCS, "search", "qwzxjkvbnmplokij"], code: 0, expect: /./ },

  // Tarefa 2 — Read Contract State (script)
  {
    name: "read: USDC cumpre os 4 requisitos",
    args: [READ, "USDC"],
    code: 0,
    expect: /bloco [\d.]+[\s\S]*Endereço\s+0xC879C018dB60520F4355C26eD1a6D572cdAC1815[\s\S]*Total em circulação\s+[\d.]+,\d+ USDC[\s\S]*\[proprietário\][\s\S]*EM LINGUAGEM SIMPLES/,
  },
  { name: "read: rótulos com 2 papéis", args: [READ, "USDC", USDC_OWNER], code: 0, expect: /\[proprietário \+ carteira consultada\][\s\S]*própria proprietária/ },
  { name: "read: WPROS em bloco fixo", args: [READ, "WPROS", "--block", "20170000"], code: 0, expect: /bloco 20\.170\.000[\s\S]*Total em circulação\s+[\d.]+,\d+ WPROS/ },
  { name: "read: --json", args: [READ, WPROS, "--json"], code: 0, expect: /"symbol": "WPROS"/ },
  { name: "read: endereço inválido", args: [READ, "0x123"], code: 1, expect: /Uso:/ },
  { name: "read: --block inválido", args: [READ, "USDC", "--block", "abc"], code: 1, expect: /--block precisa/ },
  { name: "read: endereço sem contrato", args: [READ, DEAD], code: 1, expect: /Nenhum contrato encontrado[\s\S]*não tem nenhum contrato/ },

  // Tarefa 2 — agente sem IA (regras + Chain MCP real)
  { name: "agente: ajuda instantânea", args: [AGENT, "help"], code: 0, expect: /Example questions:/, reject: /Chain MCP:/ },
  {
    name: "agente: pergunta em inglês",
    args: [AGENT, "Who owns the USDC contract?"],
    code: 0,
    expect: /plan: read the state of contract 0xC879…1815[\s\S]*Chain MCP: .*eth_call[\s\S]*The owner is 0x9F8Ea09770Dc38fc61f5a62031b3BE0526D54D92[\s\S]*read at Pharos block [\d,]+/,
  },
  { name: "agente: pergunta em português", args: [AGENT, "Quanto WPROS existe?"], code: 0, expect: /Existem [\d.]+,\d+ WPROS em circulação[\s\S]*lido no bloco [\d.]+ da Pharos/ },
  {
    name: "agente: conversa com memória (en + pt)",
    args: [AGENT],
    input: "What is the USDC contract?\nAnd who owns it?\nIs it upgradeable?\ne o WPROS está pausado?\nquantas casas decimais ele tem?\nWhat is the current block?\nbom dia\nexit\n",
    code: 0,
    expect: /This is the USDC token[\s\S]*The owner is[\s\S]*It is a "proxy" contract[\s\S]*função de pausa padrão[\s\S]*1 WPROS = 1\.000\.000\.000\.000\.000\.000 unidades[\s\S]*latest block is [\d,]+, and gas currently costs[\s\S]*Não entendi a pergunta/,
    reject: /latest block is [\d,]+[^\n]*\n\nThis is the USDC/,
  },
  { name: "agente: token fora do registro", args: [AGENT, "What about USDT?"], code: 0, expect: /USDT is not in the official Pharos token registry/ },
  { name: "agente: endereço quebrado", args: [AGENT, "Explique 0x1234"], code: 0, expect: /não é um endereço válido/ },
  { name: "agente: endereço sem contrato", args: [AGENT, `Explain the contract ${DEAD}`], code: 0, expect: /There is no contract at/ },

  // Tarefa 2 — agente com IA opcional (IA simulada, Chain MCP real)
  { name: "agente IA: ciclo completo com ferramenta", args: [AGENT_AI, "O que é o contrato do USDC?"], env: FAKE_ENV, code: 0, expect: /Contrato 0xC879C018dB60520F4355C26eD1a6D572cdAC1815, lido no bloco [\d.]+\. Este é o contrato do token USDC/ },
  { name: "agente IA: sem IA configurada", args: [AGENT_AI, "oi"], env: { PHAROS_ENV_FILE: "nenhum.env" }, code: 1, expect: /nenhum provedor de IA configurado/ },
  { name: "agente IA: IA fora do ar", args: [AGENT_AI, "oi"], env: { LLM_BASE_URL: "http://127.0.0.1:9", PHAROS_ENV_FILE: "nenhum.env" }, code: 1, expect: /não foi possível falar com a IA/ },

  // Tarefa 3 — Event/Log Monitor
  { name: "monitor: USDC --once", args: [MONITOR, "USDC", "--lookback", "1000", "--once"], code: 0, expect: /Blocos [\d.]+ a [\d.]+ verificados\.\s+Resumo: \d+ transfers/ },
  { name: "monitor: filtro --min alto", args: [MONITOR, "USDC", "--lookback", "1000", "--min", "1000000000", "--once"], code: 0, expect: /\d+ transfers vistos, 0 com valor/ },
  { name: "monitor: --min decimal", args: [MONITOR, "USDC", "--lookback", "300", "--min", "0.5", "--once"], code: 0, expect: /valor ≥ 0\.5 USDC/ },
  { name: "monitor: WPROS --once --links", args: [MONITOR, "WPROS", "--lookback", "500", "--once", "--links"], code: 0, expect: /Resumo:/ },
  { name: "monitor: token inválido", args: [MONITOR, "nada"], code: 1, expect: /Token inválido/ },
  { name: "monitor: --min sem número", args: [MONITOR, "USDC", "--min", "abc"], code: 1, expect: /--min precisa de um número/ },
  { name: "monitor: --interval baixo", args: [MONITOR, "USDC", "--interval", "0"], code: 1, expect: /--interval mínimo/ },
  { name: "monitor: --lookback acima do limite", args: [MONITOR, "USDC", "--lookback", "5000"], code: 1, expect: /--lookback precisa/ },
  { name: "monitor: endereço sem contrato", args: [MONITOR, DEAD, "--once"], code: 1, expect: /não respondeu como um token ERC20/ },
];

function run({ args, env = {}, input }) {
  return new Promise((resolve) => {
    const start = performance.now();
    const cleanEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !/^(LLM_|OPENAI_|GEMINI_|GROQ_|OPENROUTER_)/.test(k))
    );
    const child = spawn(process.execPath, args, { cwd: new URL("..", import.meta.url), env: { ...cleanEnv, ...env } });
    if (input !== undefined) child.stdin.end(input);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill(), 120_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out, secs: (performance.now() - start) / 1000 });
    });
  });
}

async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

const only = process.argv[2];
const selected = CASES.filter((c) => !only || c.name.startsWith(only));
const started = performance.now();
// Two at a time keeps the suite under the Chain MCP per-IP rate limit.
const results = await pool(selected, 2, async (c) => ({ c, r: await run(c) }));
fake.close();

let failed = 0;
for (const { c, r } of results) {
  const ok = r.code === c.code && c.expect.test(r.out) && !(c.reject && c.reject.test(r.out));
  if (!ok) failed++;
  console.log(`${ok ? "OK   " : "FALHA"} ${r.secs.toFixed(1).padStart(5)}s  ${c.name}`);
  if (!ok) console.log(`      exit ${r.code} (esperado ${c.code})\n      ${r.out.trim().split("\n").slice(-8).join("\n      ")}`);
}
console.log(`\n${results.length - failed}/${results.length} passaram em ${((performance.now() - started) / 1000).toFixed(0)}s`);
process.exitCode = failed ? 1 : 0;
