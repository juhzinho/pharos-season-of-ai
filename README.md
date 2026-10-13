# Pharos Season of AI — builds

Tarefas do [Pharos Agent Arena](https://pharos-agent-arena.vercel.app/) construídas sobre os MCPs oficiais da Pharos, sem chave de API:

| MCP | Endpoint |
|---|---|
| Chain MCP | `https://mcp.pharos.xyz/mcp` |
| Developer Docs MCP | `https://docs.pharos.xyz/~gitbook/mcp` |

Rede: Pharos Pacific Mainnet (chain ID `1672`).

## Instalação

```bash
npm install
```

Requer Node.js 18+.

## Tarefa 1 — Doc-Search CLI (Easy, 50 pts)

Wrapper de linha de comando sobre o Developer Docs MCP (`searchDocumentation`, `askQuestion`, `getPage`).

```bash
npm run docs -- search "chain id rpc mainnet" --limit 3
npm run docs -- ask "Como faço deploy de um ERC20 na Pharos?" --goal "lançar meu primeiro token"
npm run docs -- links "skill engine"
npm run docs -- page https://docs.pharos.xyz/getting-started/token-registry
```

## Tarefa 2 — Read Contract State (Easy, 50 pts)

Lê o estado de um contrato ERC20 pelo Chain MCP: confirma que há bytecode (`get_code`), depois chama `name`, `symbol`, `decimals`, `totalSupply` e, opcionalmente, `balanceOf` (`eth_call`), além do saldo nativo em PROS (`get_balance`).

```bash
npm run read -- USDC
npm run read -- WPROS 0xSuaCarteira
npm run read -- 0xQualquerTokenERC20
```

## Tarefa 3 — Event/Log Monitor (Easy, 50 pts)

Monitora eventos `Transfer` de um token pelo Chain MCP (`get_logs` + `get_block_number`). Carrega o histórico recente e depois acompanha blocos novos em tempo real, respeitando o limite de 1000 blocos por consulta.

```bash
npm run monitor -- USDC --min 500           # ao vivo, só transfers ≥ 500 USDC
npm run monitor -- WPROS --lookback 1000 --once   # varre os últimos 1000 blocos e sai
```

Opções: `--min <valor>`, `--interval <segundos>`, `--lookback <blocos>`, `--once`.
