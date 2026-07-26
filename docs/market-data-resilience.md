# Market data resilience (Birdeye + Helius + fallbacks)

## Problem

Screener showed **Market data unavailable** when Birdeye trending/new endpoints returned empty (quota, tier gaps, or sparse responses), even though Helius/Jupiter were healthy. Legacy tokenlist often omitted change%/mc/holders (all zeros).

## Fix

1. **Birdeye** — V3 `/defi/v3/token/list` primary; legacy tokenlist fallback; richer field aliases (`price24hChangePercent`, `market_cap`, `logo_uri`, …); trending retries `rank` → `volume24hUSD` → `liquidity`.
2. **Fallbacks (real data only)** — DexScreener Solana boosts/profiles + pair metrics; Raydium pools for new launches; Jupiter Price for 24h change/price fill; Helius DAS `getAsset` for name/symbol/logo.
3. **Screener route** — `loadScreenerCorpus` + `enrichScreenerRows`; response includes `source` for ops.
4. **Provider health** — Birdeye probe uses tokenlist first (trending alone was a false red).

Nothing is fabricated: empty providers → honest empty UI.
