# CryptoCheck AI Terminal OS v6

Route: `/terminalOS`  
Canonical product desk remains at `/terminal` (Portfolio Desk). This surface is the Bloomberg-style Trading OS redesign.

## Phase status

| Phase | Scope | Status |
|------|--------|--------|
| 1 | Shell, design system, mock providers, all layer panels | **In progress / shippable** |
| 2 | Live providers, TanStack Query, WebSocket | Not started |
| 3 | Behavioral engine, Pause & Teach, predictions | Not started |
| 4 | Security Center pipeline + Coach | Not started |
| 5 | Portfolio OS + Discovery scoring | Not started |
| 6 | Autonomous trading (flagged OFF) | Not started |
| 7 | AI Workforce telemetry dashboard | Stub roster only |

## Architecture

- Feature folders under `features/terminal-os/*`
- Provider ports in `shared/lib/providers.ts` — UI never imports fixtures directly for numbers
- Mock implementations in `shared/lib/mock-providers.ts`
- Client UI state: `stores/terminal-os.ts` (Zustand)
- Tokens: `styles/terminal-os.css` scoped with `[data-tos]`
- Feature flags default OFF for `autonomousTrading`, `copyTrading`, `realSwapExecution`

## Dev

```bash
npm run dev
# open http://localhost:3000/terminalOS
```

Whale classifier unit test:

```bash
npx tsx --test __tests__/terminal-os/classify-whale-movement.test.ts
```
