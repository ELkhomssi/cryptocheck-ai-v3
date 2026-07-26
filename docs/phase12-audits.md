# Phase 12 audits (12.5 AI Employees · 12.7 Screener)

## 12.5 — AI Employees vs Phase 11

| Prompt | Status | Evidence |
|--------|--------|----------|
| 11.1 Types + roster + migrations | **Implemented** | `types/agents.ts`, `lib/agents/roster.ts` (9 built-ins), `supabase/migrations/20260726_ai_employees.sql` |
| 11.2 Orchestrator API | **Implemented** | `app/api/agents/[agentId]/run/route.ts` (OpenAI `gpt-4o`, live context, activity log) |
| 11.3 Page shell | **Implemented** | `/ai-employees`, terminal nav, `AiEmployeesPanel` + cards |
| 11.4 Wire actions | **Implemented** | Chat stream + structured result panels + Accept/Dismiss feedback |
| 11.5 Performance jobs | **Implemented** | `lib/agents/performance.ts` + `/api/cron/agent-performance` + Calibrating gate |
| 11.6 Team feed/overview | **Implemented** | Activity API + TeamOverview/TeamActivityFeed |
| 11.7 Custom builder | **Implemented** | `/api/agents/custom` + `CustomEmployeeBuilder` |
| 11.8 QA | **Mostly done** | Unit tests for roster/calibrating; live roster returns 9 employees, `openaiAvailable: true` |

**Not stubbed.** Gaps are operational, not missing code:

1. Supabase migration must be applied for activity/custom/snapshots persistence.
2. Performance rings stay **Calibrating** until snapshots exist (correct per Phase 11 — not fake %).
3. News Intelligence stays honest until a news provider key + adapter is wired.

Live check (prod): `GET /api/agents/roster` → 9 employees; `GET /api/agents/trading-coach/run` → `available: true`.

## 12.7 — Screener vs Phase 10.3

| Item | Status |
|------|--------|
| Virtualized table | Present (`@tanstack/react-virtual` in `ScreenerPanel.tsx`) |
| Columns / filters / URL sync | Present |
| Birdeye connected | **Yes on production** — `GET /api/market/screener` returns `available: true` with real rows (SOL, USDC, …) |
| Search route | `/api/market/screener/search` |

**Failure that looked like “Market data unavailable”:**

- Default screener works when `BIRDEYE_API_KEY` is set on Vercel.
- **`?new=1` (New Launches)** previously intersected volume leaders with new listings → often empty, and with concurrent Birdeye calls could surface `available: false`.
- **Fix in this phase:** New Launches builds rows from `fetchNewListings` directly (skips redundant tokenlist when only `new` is set).

If a local/preview env lacks `BIRDEYE_API_KEY`, the UI correctly shows “Market data unavailable” — say so plainly; do not fabricate rows.

## 12.9 — Standing QA

After each prompt: compare against terminal tokens (`styles/tokens.css`), run `npm run lint:tokens`, and call out missing env keys instead of shipping empty silent pages.
