# Intelligence Core (Phase 17)

One orchestration layer over Phases 10–16. **Not a second copy of anything.**

## Non-negotiable

This package adds coordination only. It does not rewrite, replace, or duplicate:

- Helius / Jupiter / Birdeye / Raydium clients
- Trading, Portfolio, LaunchLab, Automation, AI Coach, Mission Feed
- AI Employees / roster, Alerts
- `agent_activity`, `agent_predictions`, `agent_performance_snapshots`
- `intelligence_score_snapshots`, Command Center

If a table or API already exists under another name — **use it**.

## Engines

| File | Role |
|------|------|
| `memory-engine.ts` | Append-only `user_memory` (interactions) |
| `context-engine.ts` | Per-consumer read/assemble (`getTradingContext`, `getCoachContext`) |
| `timeline-engine.ts` | Read `timeline_events` (filled by **DB triggers**) |
| `mission-engine.ts` | Mission Control view model assembly |
| `recommendation-engine.ts` | Grounded explanations → `agent_predictions` |
| `report-engine.ts` | Morning/Daily/Weekly/Monthly → `reports` |
| `automation-bridge.ts` | Read-only status from existing Automation recipes + `agent_activity` |

## New tables (only three)

1. `timeline_events` — via Postgres triggers on `agent_activity`, `portfolio_alerts`, `terminal_orders`
2. `user_memory` — interaction history (not a warehouse of holdings/alerts)
3. `reports` — persisted briefs

## Safety boundary (enforced)

**No file in `lib/intelligence-core/` may import or call:**

- trade execution (`lib/trading/risk-gated-swap`, swap send paths)
- wallet signing / key material
- launch deployment (`lib/launchpad` deploy, on-chain launch programs)
- automation scheduling (cron writers that arm recipes)

It may **only read status** through existing public functions/APIs (`listAgentActivity`, order status stores, AutomationBridge catalog).

Lint: `npm run lint:intelligence-core`

## Grep confirmation (17.1)

| Concern | Existing (reused) |
|---------|-------------------|
| Activity log | `agent_activity` + `lib/agents/store.ts` |
| Alerts | `portfolio_alerts` + `alerts-store.ts` |
| Predictions | `agent_predictions` |
| Module scores / module memory | `lib/intelligence/*` (Phase 16) |
| Portfolio | `buildHoldingsResponse`, `buildPortfolioAnalytics` |
| Agent context | `buildAgentLiveContext` (orchestrator path unchanged) |
| Automation recipes | `AutomationPanel` catalog — bridged, not reimplemented |
| Watchlist | `watchlist` table |
| Orders | `terminal_orders` |
