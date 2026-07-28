# CryptoCheck AI Terminal OS v6

Route: `/terminalOS`  
Canonical product desk remains at `/terminal` (Portfolio Desk). This surface is the Bloomberg-style Trading OS redesign.

## Phase status

| Phase | Scope | Status |
|------|--------|--------|
| 1 | Shell, design system, mock providers, all layer panels | Done |
| 1.1 | Gap-fix: density, live CoinGecko/DexScreener, 4K layout | **This PR** |
| 2 | WebSocket streaming + richer Birdeye/Helius wiring | Next |
| 3 | Behavioral engine, Pause & Teach, predictions | Not started |
| 4–7 | Security depth, portfolio OS, autonomy, workforce | Not started |

## Live data

`GET /api/terminal-os/feed?resource=ticker|tokens|whales|traders|snapshots|candles|overview`

- CoinGecko (no key): ticker, market overview, OHLC, trader gainers
- DexScreener (no key): per-chain tokens, whale-scale volume flows
- Optional: `WHALE_ALERT_API_KEY`, `HELIUS_API_KEY`, `BIRDEYE_API_KEY`, scan explorers

Client panels use TanStack Query (`staleTime` ~12–60s) via `live-providers.ts`.

## Dev

```bash
npm run dev
# open http://localhost:3000/terminalOS
```
