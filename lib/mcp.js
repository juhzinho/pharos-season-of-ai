import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const CHAIN_MCP_URL = process.env.PHAROS_CHAIN_MCP_URL ?? "https://mcp.pharos.xyz/mcp";
export const DOCS_MCP_URL = process.env.PHAROS_DOCS_MCP_URL ?? "https://docs.pharos.xyz/~gitbook/mcp";

export async function connect(url, name = "pharos-season-of-ai") {
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

export function toolText(result) {
  return (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export async function callTool(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = toolText(result);
  if (result.isError) throw new Error(`${name} falhou: ${text}`);
  return text;
}

// Chain MCP tools return JSON encoded as text.
export async function callJson(client, name, args = {}) {
  return JSON.parse(await callTool(client, name, args));
}
