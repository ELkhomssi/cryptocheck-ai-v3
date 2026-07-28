# CryptoCheck AI Terminal OS v6

Route: `/terminalOS`  
Canonical product desk remains at `/terminal` (Portfolio Desk). This surface is the Bloomberg-style Trading OS redesign.

## Phase status

| Phase | Scope | Status |
|------|--------|--------|
| 1 | Shell, design system, mock providers, all layer panels | Done |
| 1.1 | Gap-fix: density, live CoinGecko/DexScreener, 4K layout | Done |
| Whale marquee | Top Whale Movements SSE ticker | Done |
| **X** | **Trade Like Me** — behavioral DNA + decision engines (advise-only) | **This PR** |
| 2 | WebSocket streaming + richer Birdeye/Helius wiring | Next |
| 6 | Autonomy execution via risk-gated-swap (flagged OFF) | Gated |

## Trade Like Me

Modular engines under `features/terminal-os/ai-trade-like-me/engines/` (event bus):

1. Behavioral Learning · 2. Trader DNA · 3. Market Intelligence · 4. Prediction · 5. Decision · 6. Explainable AI · 7. Autonomous Execution (blocked by flags) · 8. Performance Analytics

- UI: `TradeLikeMeWidget` on nav **Trade Like Me** (`ai-trading`)
- API: `GET/POST /api/terminal-os/trade-like-me`
- Philosophy: learn *why* — never copy trades; AI may disagree to improve the trader
- Autonomy / real swaps stay OFF (`autonomousTrading`, `realSwapExecution`)


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
