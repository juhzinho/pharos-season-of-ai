# Task 1 — Doc-Search CLI (Easy · Docs MCP)

A command-line tool that searches the Pharos developer documentation through the official **Developer Docs MCP** (`https://docs.pharos.xyz/~gitbook/mcp`). No API key needed.

| Command | MCP tool | What it does |
|---|---|---|
| `search <term>` | `searchDocumentation` | Matching pages with title, link and a short excerpt |
| `links <term>` | `searchDocumentation` | Only titles and links |
| `ask <question>` | `askQuestion` | Synthesized answer with sources (`--goal` adds context) |
| `page <url\|path>` | `getPage` | Full page as markdown (only `docs.pharos.xyz` pages) |

## Run

From the repository root (Node.js 20.12+):

```bash
npm install
npm run docs -- search "chain id rpc mainnet" --limit 3
npm run docs -- ask "How do I deploy an ERC20 on Pharos?" --goal "launch my first token"
npm run docs -- links "skill engine"
npm run docs -- page /getting-started/token-registry
npm run docs -- --help
```

Options: `--limit <1-20>` (default 5) for `search`/`links`, `--goal "<text>"` for `ask`. Invalid commands, options and non-docs URLs are rejected before any network call.

## Example output

```
$ npm run docs -- search "chain id rpc mainnet" --limit 3

1. x402
   https://docs.pharos.xyz/developer-guide/x402
   import dotenv from "dotenv"; import express from "express"; import { privateKeyToAccount } from "viem/accounts"; …

2. Pharos Skill Engine
   https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide
   SKILL.md The entry point — read by the AI agent first Defines what capabilities exist and where to find detailed …

3. Pacific Mainnet
   https://docs.pharos.xyz/getting-started/network/pacific-mainnet
   Network Pharos Pacific Mainnet ChainID 1672 Coin Symbol/Ticker PROS RPC URL https://rpc.pharos.xyz Block Explorer https://www.pharosscan.xyz …
```

## Code

- [`cli.js`](cli.js) — argument parsing and output
- [`../../lib/docs.js`](../../lib/docs.js) — Docs MCP calls and result parsing
- [`../../lib/mcp.js`](../../lib/mcp.js) — MCP client with retries for network failures

Tests: `npm run test:e2e -- docs` (15 end-to-end cases against the live Docs MCP).
