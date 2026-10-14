import { connect, CHAIN_MCP_URL } from "./mcp.js";

// One Chain MCP session per warm serverless instance; dropped after errors or when it gets old.
const MAX_AGE_MS = 5 * 60_000;
let connection = null;

export function getSharedClient() {
  if (connection && Date.now() - connection.at > MAX_AGE_MS) resetSharedClient();
  if (!connection) {
    const promise = connect(CHAIN_MCP_URL, "pharos-contract-reader-web");
    connection = { promise, at: Date.now() };
    promise.catch(() => (connection = null));
  }
  return connection.promise;
}

export function resetSharedClient() {
  const old = connection;
  connection = null;
  old?.promise.then((c) => c.close()).catch(() => {});
}
