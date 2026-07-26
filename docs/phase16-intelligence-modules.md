# Phase 16 — Intelligence Modules, Scores & Memory

Makes Phase 15’s “hide the workers” concrete: six Intelligence Modules with
real worker counts, health scores, stats, memory, timeline, and graphs.

## Calibrating thresholds (exact)

Defined in `types/intelligence.ts` → `INTEL_SCORE_THRESHOLDS`:

| Gate | Value |
|------|-------|
| Min non-Calibrating workers with a real performance % | **2** |
| Min provider uptime probes in window | **6** |
| Min uptime history span | **24h** |
| Min modules with a real score for Overall System Health | **3** |

Weights: worker performance **0.5** · provider uptime **0.3** · data freshness **0.2**.

If every mapped worker is still Calibrating → module shows **Calibrating** (never a fabricated %).

## Worker → module mapping

Roster field: `AIEmployee.modules: IntelligenceModuleId[]` in `lib/agents/roster.ts`.

| Module | Current roster workers |
|--------|------------------------|
| Market | whale-analyst |
| Security | scam-investigator |
| Trading | trading-coach |
| Portfolio | portfolio-manager, risk-manager |
| Launch | launch-advisor, scam-investigator (shared) |
| Research | research-analyst, market-strategist, news-intelligence* |

\*News Intelligence counts only when a news provider env key is configured.

Worker count API: `countActiveWorkersForModule` in `lib/intelligence/modules.ts` —
UI must never hardcode counts.

## Key surfaces

- Mission Control: System Status strip + module cards (`IntelligenceModulesGrid`)
- Detail: memory (Y/T/T), timeline (filtered Mission Feed), score graph
- Crons: `/api/cron/intelligence-score` (hourly), `/api/cron/intelligence-memory` (daily)
- Tables: `intelligence_score_snapshots`, `intelligence_module_memory`
- Copy lint: `npm run lint:ai-voice`
- Tests: `npm run test:intelligence-modules`

## Alive-never-fake

Stats/scores/graphs with insufficient data render **Calibrating**, **—**, or honest idle
copy — never plausible placeholders.
