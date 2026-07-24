/**
 * Phase 10.9 — Definition of Done checklist (terminal production layer).
 * Keep this in sync when auditing before merge.
 *
 * Route: /terminal (legacy /portfolio → 308 redirect)
 *
 * [x] Provider clients server-only under lib/providers/* + Redis TTL cache
 * [x] Market feeds: gainers/losers/trending/new-launches/graduated/volume/smart-money
 * [x] Screener virtualized + URL filters + server search
 * [x] Watchlist persisted in Supabase (auth) with live metrics poll ≤10s
 * [x] Portfolio analytics FIFO + AI Hold/Buy/Reduce/Exit review
 * [x] Coach grounded on live holdings/alerts/trending/mentioned mints
 * [x] Alerts webhook + preferences + optional Birdeye cron
 * [x] Trade panel via existing Jupiter risk-gated swap; orders tracked in Supabase
 * [x] No fabricated market numbers — empty/error when providers unavailable
 * [ ] Ops: apply 20260724_* migrations; set BIRDEYE/HELIUS/ANTHROPIC/Upstash envs
 * [ ] Ops: register Helius webhook → /api/webhooks/helius
 */

export const PHASE10_TERMINAL_PATH = '/terminal' as const
