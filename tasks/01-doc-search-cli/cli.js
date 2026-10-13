#!/usr/bin/env node
import { connect, callTool, DOCS_MCP_URL } from "../../lib/mcp.js";

const HELP = `pharos-docs — busca na documentação da Pharos via Developer Docs MCP

Uso:
  node tasks/01-doc-search-cli/cli.js search <termo>       busca trechos na documentação
  node tasks/01-doc-search-cli/cli.js ask <pergunta>       resposta sintetizada com fontes
  node tasks/01-doc-search-cli/cli.js page <url>           página completa em markdown
  node tasks/01-doc-search-cli/cli.js links <termo>        só os links dos resultados

Opções:
  --goal "<objetivo>"   contexto para o comando ask
  --limit <n>           máximo de resultados no search (padrão 5)
`;

function parseArgs(argv) {
  const opts = { limit: 5, goal: undefined };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--goal") opts.goal = argv[++i];
    else if (argv[i] === "--limit") opts.limit = Number(argv[++i]);
    else rest.push(argv[i]);
  }
  const [command, ...words] = rest;
  return { command, input: words.join(" "), opts };
}

// searchDocumentation returns blocks of "Title: / Link: / Content:".
function parseResults(text) {
  return text
    .split(/\n(?=Title: )/)
    .map((block) => {
      const title = block.match(/^Title: (.*)$/m)?.[1]?.trim();
      const link = block.match(/^Link: (.*)$/m)?.[1]?.trim();
      const content = block.split(/^Content: /m)[1]?.trim() ?? "";
      return title ? { title, link, content } : null;
    })
    .filter(Boolean);
}

function snippet(content, max = 240) {
  const flat = content.replace(/\s+/g, " ");
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

async function main() {
  const { command, input, opts } = parseArgs(process.argv.slice(2));
  if (!command || command === "help" || command === "--help" || !input) {
    console.log(HELP);
    process.exit(command ? 1 : 0);
  }

  const client = await connect(DOCS_MCP_URL, "pharos-docs-cli");
  try {
    if (command === "search" || command === "links") {
      const results = parseResults(await callTool(client, "searchDocumentation", { query: input }));
      const seen = new Set();
      const unique = results.filter((r) => !seen.has(r.link) && seen.add(r.link)).slice(0, opts.limit);
      if (!unique.length) return console.log(`Nenhum resultado para "${input}".`);
      unique.forEach((r, i) => {
        console.log(`${i + 1}. ${r.title}\n   ${r.link}`);
        if (command === "search") console.log(`   ${snippet(r.content)}\n`);
      });
    } else if (command === "ask") {
      console.log(await callTool(client, "askQuestion", { question: input, ...(opts.goal && { goal: opts.goal }) }));
    } else if (command === "page") {
      console.log(await callTool(client, "getPage", { url: input }));
    } else {
      console.log(`Comando desconhecido: ${command}\n\n${HELP}`);
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
});
