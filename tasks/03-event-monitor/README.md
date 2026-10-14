# Task 3 — Event/Log Monitor (Easy · Chain MCP)

Watches a Pharos mainnet token for ERC20 `Transfer` events through the official **Chain MCP** (`https://mcp.pharos.xyz/mcp`) and reports each new one as it happens. It keeps running until you stop it. No wallet or key needed.

**Live demo:** https://pharos-contract-reader.vercel.app/#events

## Requirements

| Requirement | How |
|---|---|
| Chain MCP log queries filtered by contract address and event signature | `get_logs` with `address` = the token and `topics[0]` = `keccak256("Transfer(address,address,uint256)")` = `0xddf252ad…b3ef` (printed at startup); new blocks via `get_block_number` |
| Runs continuously, only new events, no duplicates | Polls every `--interval` seconds and only asks for blocks after the last one checked. Each cycle also re-reads the last 5 blocks in case the node indexed their logs late; every event is keyed by `tx hash + log index`, so nothing is reported twice. Network failures are retried and the loop keeps going |
| Decodes each event into readable fields | block, kind (`TRANSFER` / `MINT` / `BURN`), amount with token decimals applied, from, to (known addresses labelled), full tx hash (or explorer link with `--links`) |
| Demonstrated catching live events | See the live run below (7 new mainnet transfers caught in 2 minutes) and the live demo page |

`get_logs` accepts at most 1000 blocks per query, so larger ranges are split automatically. The `--min` filter compares exact integers (no floating-point rounding).

## Run

From the repository root (Node.js 20.12+):

```bash
npm install
npm run monitor -- USDC                            # live, all transfers
npm run monitor -- USDC --min 500                  # live, only transfers ≥ 500 USDC
npm run monitor -- WPROS --lookback 1000 --once    # scan the last 1000 blocks and exit
npm run monitor -- 0xAnyErc20Token --links
```

| Option | Default | Meaning |
|---|---|---|
| `--min <amount>` | 0 | Only show transfers ≥ amount (token units, decimals allowed) |
| `--interval <s>` | 5 | Seconds between checks in live mode (minimum 2) |
| `--lookback <blocks>` | 200 | Initial history, 0 to 1000 blocks |
| `--once` | off | Scan history, print a summary and exit |
| `--links` | off | Print the pharosscan link instead of the bare tx hash |

Press Ctrl+C to stop; it prints a summary. If nothing matches for a minute it prints a short "still watching" line so you know it is alive.

## Live run — catching new mainnet events

Started with no history (`--lookback 0`), so every line below is an event that happened **after** the monitor started:

```
$ npm run monitor -- USDC --lookback 0 --interval 3

Watching Transfer events of USDC (0xc879c018db60520f4355c26ed1a6d572cdac1815) via Chain MCP
get_logs filter: address 0xc879c018db60520f4355c26ed1a6d572cdac1815, topic0 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef (Transfer(address,address,uint256))
Filter: amount ≥ 0 USDC | interval 3s | initial history 0 blocks

— history loaded (up to block 20,181,521). Watching for new events… (Ctrl+C to stop)

NEW [block 20,181,524] TRANSFER 600 USDC  from 0xBaA1…D4C5 → to 0x86C8…F95f
    tx 0xc829efc49a1d5dfdf0193e27aecf08f229afa5b16544d43c477bc87861633908
NEW [block 20,181,533] TRANSFER 313.306956 USDC  from 0x912c…f647 → to 0x9365…b470
    tx 0x92e948e5cc1ce8f13a738e816c216235140944816286ebd8707a4a4e25705e74
NEW [block 20,181,533] TRANSFER 156.653738 USDC  from 0x4146…5623 → to 0x9365…b470
    tx 0x45a7cbaf835e6b028730c66e8f6cee2bcb1324ca735c514c2360bfba64dcaddf
NEW [block 20,181,571] TRANSFER 626.730449 USDC  from 0x9365…b470 → to 0x912c…f647
    tx 0x2c8fd167c5f1db793961038c646adb8f7188e803f85eb3da63440d4e5ecd1274
NEW [block 20,181,575] TRANSFER 313.626669 USDC  from 0x912c…f647 → to 0x9365…b470
    tx 0x7f2b41bbce3085b74f104724e4d013768d3d4d5571bc3f36868f9c950b7ac5e8
NEW [block 20,181,587] TRANSFER 156.726316 USDC  from 0x9365…b470 → to 0x912c…f647
    tx 0x4c113b4efa1f26e7dce4ef72b6b438f47a47aee4cfba3e4c6f54a503bd682aae
NEW [block 20,181,601] TRANSFER 15.2 USDC  from 0x86C8…F95f → to 0x768B…dE54
    tx 0x551a8f7a3b47203e51afbf680083fabdebe479814352e7507d7e8864ac20b9b0
```

Any of these can be checked on the explorer, e.g. [0xc829…3908](https://www.pharosscan.xyz/tx/0xc829efc49a1d5dfdf0193e27aecf08f229afa5b16544d43c477bc87861633908).

## Code

- [`monitor.js`](monitor.js) — options, live loop, de-duplication and output
- [`../../lib/transfers.js`](../../lib/transfers.js) — `get_logs` queries and event decoding (shared with the live demo)
- [`../../lib/format.js`](../../lib/format.js) — exact amount formatting and address labels

Tests: `npm run test:e2e -- monitor` (10 end-to-end cases against mainnet, including one that keeps live mode running).
