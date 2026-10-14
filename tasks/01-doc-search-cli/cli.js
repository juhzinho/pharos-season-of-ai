#!/usr/bin/env node
import { connect, DOCS_MCP_URL } from "../../lib/mcp.js";
import { askDocs, DOCS_ORIGIN, getDocsPage, parseAnswer, resolveDocsUrl, searchDocs, snippet } from "../../lib/docs.js";
import { detectLanguage } from "../../lib/intent.js";

const HELP = `pharos-docs — search the Pharos documentation from your terminal (Developer Docs MCP)

Usage:
  pharos-docs "<question>"          concise answer with links to the source pages
  pharos-docs search <terms>        matching pages with a short excerpt
  pharos-docs links <terms>         only titles and links
  pharos-docs page <url|path>       full page as markdown

Options:
  --goal "<goal>"   extra context for a question
  --limit <n>       max results for search/links, 1 to 20 (default 5)

Examples:
  pharos-docs "how do I deploy a contract?"
  pharos-docs "Qual o chain ID da mainnet?"
  pharos-docs search "chain id rpc mainnet" --limit 3
  pharos-docs page /getting-started/token-registry

Without installing the command: npm run docs -- "<question>"
`;

const COMMANDS = ["search", "links", "ask", "page"];

const TEXT = {
  en: {
    sources: "Sources:",
    none: (q) => `No good answer found in the Pharos docs for "${q}".`,
    said: "Docs MCP reply:",
    tip: 'Try other keywords, e.g. pharos-docs search "<keywords>", or browse https://docs.pharos.xyz',
  },
  pt: {
    sources: "Fontes:",
    none: (q) => `Nenhuma boa resposta encontrada na documentação da Pharos para "${q}".`,
    said: "Resposta do Docs MCP:",
    tip: 'Tente outras palavras, por exemplo pharos-docs search "<palavras>", ou veja https://docs.pharos.xyz',
  },
};

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
      if (!opts.goal || opts.goal.startsWith("--")) fail("--goal needs a text.");
    } else if (a === "--limit") {
      opts.limit = Number(argv[++i]);
      if (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > 20) fail("--limit must be an integer from 1 to 20.");
    } else if (a === "--help" || a === "-h") {
      return { command: "help", input: "", opts };
    } else if (a.startsWith("--")) {
      fail(`Unknown option: ${a}`);
    } else rest.push(a);
  }
  if (!rest.length || rest[0] === "help") return { command: "help", input: "", opts };
  // Anything that does not start with a command is a question: pharos-docs "how do I deploy a contract?"
  const [command, ...words] = COMMANDS.includes(rest[0]) ? rest : ["ask", ...rest];
  return { command, input: words.join(" ").trim(), opts };
}

function docsUrl(input) {
  const { url, error } = resolveDocsUrl(input);
  if (error === "invalid") fail(`Invalid URL: ${input}`);
  if (error === "foreign") fail(`page only opens pages from ${DOCS_ORIGIN}.`);
  return url;
}

function printAnswer(question, reply) {
  const t = TEXT[detectLanguage(question, "en")];
  const { answer, sources, found } = parseAnswer(reply);
  if (!found) {
    console.log(`${t.none(question)}\n\n${t.said} ${answer || "(empty)"}\n\n${t.tip}`);
    return;
  }
  console.log(`${answer}\n\n${t.sources}`);
  sources.forEach((s, i) => console.log(`  ${i + 1}. ${s.title}\n     ${s.url}`));
}

async function main() {
  const { command, input, opts } = parseArgs(process.argv.slice(2));
  if (command === "help") {
    console.log(HELP);
    process.exit(0);
  }
  if (!input) fail(`${command} needs ${command === "page" ? "a page URL or path" : "some text"}.`);
  const pageUrl = command === "page" ? docsUrl(input) : null;

  const client = await connect(DOCS_MCP_URL, "pharos-docs-cli");
  try {
    if (command === "search" || command === "links") {
      const unique = await searchDocs(client, input, opts.limit);
      if (!unique.length) return console.log(`No results for "${input}".`);
      unique.forEach((r, i) => {
        console.log(`${i + 1}. ${r.title}\n   ${r.link}`);
        if (command === "search") console.log(`   ${snippet(r.content)}\n`);
      });
    } else if (command === "ask") {
      printAnswer(input, await askDocs(client, input, opts.goal));
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
    console.error(`Error: ${e.message}`);
    process.exit(1);
  });
