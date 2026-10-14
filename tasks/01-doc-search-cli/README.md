# Task 1 — Doc-Search CLI (Easy · Developer Docs MCP)

`pharos-docs` lets a developer ask the Pharos documentation a question from the terminal and get a concise answer with links to the source pages. It is a small wrapper over the official **Developer Docs MCP** (`https://docs.pharos.xyz/~gitbook/mcp`). No API key needed.

**Live demo:** https://pharos-contract-reader.vercel.app/#docs

## Requirements

| Requirement | How |
|---|---|
| Natural-language question as input | `pharos-docs "how do I deploy a contract?"` — any text that is not a subcommand is a question (`askQuestion`) |
| Concise answer + links to sources | The answer is printed first, then up to 5 source pages (pages cited in the answer first, duplicates removed, relative links turned into full `docs.pharos.xyz` URLs) |
| "No good answer found" handled gracefully | When the docs have nothing on the topic, it says so plainly, shows the Docs MCP reply and suggests a keyword search — it never prints a made-up answer or fake sources |
| README with install, usage, 3 examples | This file |

Labels follow the language of the question (English or Portuguese).

## Install

Requires Node.js 20.12+.

```bash
git clone https://github.com/juhzinho/pharos-season-of-ai.git
cd pharos-season-of-ai
npm install
npm link            # optional: installs the `pharos-docs` command globally
```

Without `npm link`, use `npm run docs -- "<question>"` from the repository folder.

## Usage

```bash
pharos-docs "<question>"                 # concise answer + sources
pharos-docs "<question>" --goal "<goal>" # extra context for the answer
pharos-docs search <terms> [--limit n]   # matching pages with an excerpt (1-20, default 5)
pharos-docs links <terms>                # only titles and links
pharos-docs page <url|path>              # full page as markdown (docs.pharos.xyz only)
pharos-docs --help
```

## 3 example queries

### 1. How do I deploy a contract?

```
$ pharos-docs "how do I deploy a contract?"

For Pharos, deploy with Foundry by compiling your contract, setting a funded deployer key, and broadcasting a deployment script to the network.

forge build
forge test
export PRIVATE_KEY=<your private key>
forge script script/DeployToken.s.sol --rpc-url <PHAROS_RPC_URL> --broadcast

Your script should load `PRIVATE_KEY`, start broadcasting, and deploy the contract with `new YourContract(...)`. Replace `<PHAROS_RPC_URL>` with your chosen Pharos network's RPC endpoint. Make sure the deployer has enough testnet tokens to cover deployment costs.

For a complete example, including a deployment script, see [Write Your First Token](https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token). If you use Hardhat, see [Write Your First Token](https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token).

Sources:
  1. Write Your First Token
     https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token
  2. Write Your First Token
     https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
  3. Write Your First Uniswap Contract
     https://docs.pharos.xyz/developer-guide/foundry/write-your-first-uniswap-contract
  4. Write Your First Uniswap Contract
     https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-uniswap-contract
  5. Write Your First NFT
     https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
```

### 2. Network details

```
$ pharos-docs "What is the chain ID and RPC URL of Pharos mainnet?"

Pharos Pacific Mainnet uses **chain ID `1672`** and RPC URL [`https://rpc.pharos.xyz`](https://rpc.pharos.xyz). See [Pacific Mainnet](https://docs.pharos.xyz/getting-started/network/pacific-mainnet).

Sources:
  1. Pacific Mainnet
     https://docs.pharos.xyz/getting-started/network/pacific-mainnet
  2. Node Debugging & Configuration
     https://docs.pharos.xyz/node-and-validator-guide/node-debugging-and-configuration
  3. ZAN RPC
     https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan
  4. Atlantic Testnet
     https://docs.pharos.xyz/getting-started/network/atlantic-testnet
  5. RPC Infrastructure
     https://docs.pharos.xyz/tooling-and-infrastructure/rpc
```

### 3. A question the docs cannot answer

```
$ pharos-docs "what is the recipe for brazilian feijoada?"

No good answer found in the Pharos docs for "what is the recipe for brazilian feijoada?".

Docs MCP reply: I cannot find information about Brazilian feijoada in the docs.

Try other keywords, e.g. pharos-docs search "<keywords>", or browse https://docs.pharos.xyz
```

## Code

- [`cli.js`](cli.js) — argument parsing and output
- [`../../lib/docs.js`](../../lib/docs.js) — Docs MCP calls, answer/source parsing and the "no answer" check
- [`../../lib/mcp.js`](../../lib/mcp.js) — MCP client with retries for network failures

Tests: `npm run test:unit` (answer parsing) and `npm run test:e2e -- docs` (17 end-to-end cases against the live Docs MCP).
