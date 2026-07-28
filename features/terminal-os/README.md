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

## Trade Like Me (Master Spec V2)

Modular engines under `features/terminal-os/ai-trade-like-me/engines/` — **event bus only** (no cross-engine internals):

1. Behavioral Learning (trades **+ rejections**) · 2. Trader DNA (style vector Σ=1, `confidence` + `sampleSize` retention) · 3. Market Intelligence (`MarketContext`) · 4. Prediction · 5. Decision (`computeConfidence` inspectable, cosine behaviorMatch) · 6. Explainable AI (field citations) · 7. Autonomous Execution (**audit log** product surface, flags OFF) · 8. Performance Analytics (AI vs baseline proof) · 9. **Collective Intelligence** (opt-in, anonymized)

Moat rules: leaving costs DNA confidence; every number is traceable; cross-user signal never leaks wallets.


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
