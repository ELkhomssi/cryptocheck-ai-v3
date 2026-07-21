# Terminal data modes

| Mode | When | Badge | Behavior |
|------|------|-------|----------|
| `demo` | Default in non-production, or toggle / `NEXT_PUBLIC_TERMINAL_DATA_MODE=demo` | **DEMO DATA** (amber) | Fills all panels from `DEMO_SEED` (`lib/trading-terminal/data/demo-seed.ts`) |
| `live` | Default in production, or toggle / env=`live` | none | Real feeds only; honest institutional empty states |

Toggle: top-bar control (persists to `localStorage` key `ccai:trading-terminal:data-mode`).

Adapters: `getTerminalSnapshot(mode)` in `adapters.ts`. Components must not import seed numbers directly.
