# Task 3 — Event/Log Monitor (Easy · Chain MCP)

Watches ERC20 `Transfer` events of a Pharos mainnet token through the official **Chain MCP** (`https://mcp.pharos.xyz/mcp`, tools `get_logs` and `get_block_number`). It first scans recent history, then follows new blocks live. No wallet or key needed.

- Respects the `get_logs` limit of 1000 blocks per query (larger ranges are split).
- Applies token decimals, flags `MINT` / `BURN`, labels known addresses.
- `--min` filter compared with exact integers (no floating point rounding).
- Network failures are retried; the live loop keeps running and reports them.

## Run

From the repository root (Node.js 20.12+):

```bash
npm install
npm run monitor -- USDC --min 500                  # live, only transfers ≥ 500 USDC
npm run monitor -- WPROS --lookback 1000 --once    # scan the last 1000 blocks and exit
npm run monitor -- USDC --links                    # explorer link for each transaction
npm run monitor -- 0xAnyErc20Token --once
```

| Option | Default | Meaning |
|---|---|---|
| `--min <amount>` | 0 | Only show transfers ≥ amount (in token units, decimals allowed) |
| `--interval <s>` | 5 | Seconds between checks in live mode (minimum 2) |
| `--lookback <blocks>` | 200 | Initial history, 0 to 1000 blocks |
| `--once` | off | Scan history, print a summary and exit |
| `--links` | off | Print the pharosscan link of each transaction |

Press Ctrl+C in live mode to stop and see the summary. Output is in Portuguese (`bloco` = block, `Resumo` = summary, `vistos` = seen).

## Example output

```
$ npm run monitor -- USDC --lookback 300 --once

Monitorando eventos Transfer de USDC (0xc879c018db60520f4355c26ed1a6d572cdac1815) via Chain MCP
Filtro: valor ≥ 0 USDC | intervalo 5s | histórico inicial 300 blocos

[bloco 20.179.805] Transfer 39,25803 USDC  0x9365…b470 → 0x912c…f647  tx 0x20c6…c171
[bloco 20.179.807] Transfer 213,241918 USDC  0x15dD…5315 → 0x912c…f647  tx 0x362d…5d3f
[bloco 20.179.874] Transfer 505,399786 USDC  0xb143…B048 → 0x4226…ABB6  tx 0xefdb…105d
[bloco 20.179.924] Transfer 600 USDC  0x4758…84CD → 0x55Aa…D47d  tx 0x969d…99cc
…
[bloco 20.180.086] Transfer 39,305525 USDC  0x9365…b470 → 0x912c…f647  tx 0x24bf…7723

Blocos 20.179.799 a 20.180.098 verificados.

Resumo: 23 transfers vistos, 23 com valor ≥ 0 USDC, volume total 5.259,43 USDC
```

## Code

- [`monitor.js`](monitor.js) — the monitor
- [`../../lib/mcp.js`](../../lib/mcp.js) — MCP client with retries for network failures
- [`../../lib/format.js`](../../lib/format.js) — exact amount formatting and address labels

Tests: `npm run test:e2e -- monitor` (9 end-to-end cases against mainnet).
