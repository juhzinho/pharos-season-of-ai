import { callTool } from "./mcp.js";

export const DOCS_ORIGIN = "https://docs.pharos.xyz";

// searchDocumentation returns blocks of "Title: / Link: / Content:".
export function parseResults(text) {
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

export function snippet(content, max = 240) {
  const flat = content.replace(/\s+/g, " ");
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

/** Accepts full docs URLs and site paths like /getting-started/token-registry. */
export function resolveDocsUrl(input) {
  let url;
  try {
    url = new URL(input, DOCS_ORIGIN);
  } catch {
    return { error: "invalid" };
  }
  if (url.origin !== DOCS_ORIGIN) return { error: "foreign" };
  return { url: url.href };
}

/** Search results with duplicate pages removed. */
export async function searchDocs(client, query, limit = 5) {
  const seen = new Set();
  return parseResults(await callTool(client, "searchDocumentation", { query }))
    .filter((r) => !seen.has(r.link) && seen.add(r.link))
    .slice(0, limit);
}

export function askDocs(client, question, goal) {
  return callTool(client, "askQuestion", { question, ...(goal && { goal }) });
}

export function getDocsPage(client, url) {
  return callTool(client, "getPage", { url });
}
