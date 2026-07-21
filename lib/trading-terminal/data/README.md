# Terminal data modes

| Mode | When | Badge | Behavior |
|------|------|-------|----------|
| `demo` | Default in non-production, or toggle / `NEXT_PUBLIC_TERMINAL_DATA_MODE=demo` | **DEMO DATA** (amber) | Fills all panels from `DEMO_SEED` (`lib/trading-terminal/data/demo-seed.ts`) |
| `live` | Default in production, or toggle / env=`live` | none | Real feeds only; honest institutional empty states |

Toggle: top-bar control (persists to `localStorage` key `ccai:trading-terminal:data-mode`).

Adapters: `getTerminalSnapshot(mode)` in `adapters.ts`. Components must not import seed numbers directly.

## Live densification

- **Portfolio Brain** — `lib/trading-terminal/live-portfolio-brain.ts` derives Health / Exposure / Threats / Action Queue from `/api/revenue/portfolio` (no invented desk research).
- **Discover enrich** — `lib/trading-terminal/discover-enrich.ts` overlays DexScreener price / mcap / 24h Δ on signal rows.
- **Chart marks** — demo trades from seed; live marks from local trade log only.
- Positions Size / Entry / Price / P/L map from portfolio tracker; estimated basis shows `est` / hides P/L.

