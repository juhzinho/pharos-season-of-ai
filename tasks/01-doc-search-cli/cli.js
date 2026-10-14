#!/usr/bin/env node
import { connect, DOCS_MCP_URL } from "../../lib/mcp.js";
import { askDocs, DOCS_ORIGIN, getDocsPage, resolveDocsUrl, searchDocs, snippet } from "../../lib/docs.js";

const HELP = `pharos-docs — busca na documentação da Pharos via Developer Docs MCP

Uso:
  node tasks/01-doc-search-cli/cli.js search <termo>       busca trechos na documentação
  node tasks/01-doc-search-cli/cli.js ask <pergunta>       resposta sintetizada com fontes
  node tasks/01-doc-search-cli/cli.js page <url|caminho>   página completa em markdown
  node tasks/01-doc-search-cli/cli.js links <termo>        só os links dos resultados

Opções:
  --goal "<objetivo>"   contexto para o comando ask
  --limit <n>           máximo de resultados no search/links, de 1 a 20 (padrão 5)

Exemplos:
  search "chain id rpc mainnet"
  ask "Como faço deploy de um ERC20?" --goal "lançar meu primeiro token"
  page /getting-started/token-registry
`;

const COMMANDS = ["search", "links", "ask", "page"];

function fail(message) {
  console.log(`${message}\n\n${HELP}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { limit: 5, goal: undefined };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--goal") {
      opts.goal = argv[++i];
      if (!opts.goal || opts.goal.startsWith("--")) fail("--goal precisa de um texto.");
    } else if (a === "--limit") {
      opts.limit = Number(argv[++i]);
      if (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > 20) fail("--limit precisa ser um inteiro de 1 a 20.");
    } else if (a === "--help" || a === "-h") {
      rest.unshift("help");
    } else if (a.startsWith("--")) {
      fail(`Opção desconhecida: ${a}`);
    } else rest.push(a);
  }
  const [command, ...words] = rest;
  return { command, input: words.join(" ").trim(), opts };
}

function docsUrl(input) {
  const { url, error } = resolveDocsUrl(input);
  if (error === "invalid") fail(`URL inválida: ${input}`);
  if (error === "foreign") fail(`O comando page só abre páginas de ${DOCS_ORIGIN}.`);
  return url;
}

async function main() {
  const { command, input, opts } = parseArgs(process.argv.slice(2));
  if (!command || command === "help") {
    console.log(HELP);
    process.exit(0);
  }
  if (!COMMANDS.includes(command)) fail(`Comando desconhecido: ${command}`);
  if (!input) fail(`O comando ${command} precisa de um ${command === "page" ? "endereço de página" : "texto"}.`);
  const pageUrl = command === "page" ? docsUrl(input) : null;

  const client = await connect(DOCS_MCP_URL, "pharos-docs-cli");
  try {
    if (command === "search" || command === "links") {
      const unique = await searchDocs(client, input, opts.limit);
      if (!unique.length) return console.log(`Nenhum resultado para "${input}".`);
      unique.forEach((r, i) => {
        console.log(`${i + 1}. ${r.title}\n   ${r.link}`);
        if (command === "search") console.log(`   ${snippet(r.content)}\n`);
      });
    } else if (command === "ask") {
      console.log(await askDocs(client, input, opts.goal));
    } else {
      console.log(await getDocsPage(client, pageUrl));
    }
  } finally {
    await client.close().catch(() => {});
  }
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  });
