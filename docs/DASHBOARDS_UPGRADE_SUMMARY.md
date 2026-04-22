# Dashboards & platform upgrade summary

This document captures the **CryptoCheck AI** upgrade arc across the **authenticated dashboard** (`/dashboard`), the **public Pro surface** (`/pro/dashboard`), supporting **APIs**, and **operational** surfaces. Use it for handoffs, audits, and onboarding.

---

## Product surfaces

| Surface | Path | Audience |
|--------|------|----------|
| Authenticated console | `/dashboard` | Signed-in users (layout enforces auth) |
| Public Intelligence Terminal | `/pro/dashboard` | Marketing + live demo (public scan with IP limits) |
| Public status | `/status` | Everyone (SLA copy, live checks, optional incidents) |
| API docs (HTML) | `/api/docs` | Developers |
| API notes (Markdown) | `docs/api.md` | Developers |

---

## Phase map (high level)

1. **Critical reliability** — Billing subscription fetch hardening, Instant Pulse deduplication, DexScreener-backed metrics, liquidity lock heuristics in the Intelligence Terminal report.
2. **Performance** — Parallel scan enrichment, Redis-backed scan cache, scan pipeline telemetry (`scan_timings`), usage page hooks, Solana enrichment parallelism, **uptime cron** warming paths.
3. **Live `/pro/dashboard`** — Public scan + rate limits, public audit export, hero scanner, pulse feed (SWR), JSON/curl export patterns.
4. **Enterprise webhooks** — `institutional_webhooks` extensions, signed delivery (`X-CryptoCheck-Signature: sha256=…`), retry queue + cron, dashboard CRUD + test hook, `risk.changed` from watchlist cron, `scan.completed` / legacy `high_safety_token` from scans.
5. **Batch** — `POST /api/v1/scan/batch` optional `clientRef` / `X-CryptoCheck-Client-Ref`, shared `maxBatchSizeForTier`, dashboard **`/dashboard/batch`** for session-based batch runs.
6. **Public status & SLA** — Shared `collectHealthSnapshot`, **`/status`** page, **`GET /api/status/public`**, Redis probe list from uptime cron, optional **`STATUS_ACTIVE_INCIDENTS_JSON`**, vanity redirect **`status.cryptocheckai.com` → www `/status`** in `vercel.json`.
7. **Historical & compliance hub** — This document plus **`/dashboard/compliance`** (navigation to audit exports, security logs, usage, portfolio CSV, webhooks, public status, retention notes).

---

## Supabase migrations (run in order where applicable)

| File | Purpose |
|------|---------|
| `supabase-webhooks-migration.sql` | Base `institutional_webhooks` table |
| `supabase-webhooks-enterprise-migration.sql` | Columns `is_active`, `last_success_at`, `consecutive_failures`; `institutional_webhook_deliveries`; `institutional_webhook_retry_queue`; RLS for owner access |
| `supabase-scan-timings-migration.sql` | `scan_timings` for pipeline latency telemetry |

Apply in your Supabase SQL editor or migration pipeline. RLS assumptions match the app’s service-role vs user clients.

---

## Vercel cron (`vercel.json`)

| Path | Schedule | Notes |
|------|----------|--------|
| `/api/cron/watchlist-scan` | `0 9 * * *` | Daily watchlist; requires `CRON_SECRET` |
| `/api/cron/uptime-check` | `0 0 * * *` (daily UTC) | Warms health + DexScreener; records **`recordUptimeProbe`** when Redis configured (Hobby-friendly; upgrade for higher cadence) |
| `/api/cron/webhook-retry` | `0 0 * * *` (daily UTC) | Webhook retry queue (same) |

Vercel injects **`Authorization: Bearer ${CRON_SECRET}`** when **`CRON_SECRET`** is set in project env.

---

## Environment variables (reference)

| Variable | Used for |
|----------|-----------|
| `CRON_SECRET` | Securing cron routes |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin paths, health DB check, webhooks, retries |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limits, scan cache, **uptime probe list** |
| `HELIUS_KEY` | RPC health check |
| `STATUS_ACTIVE_INCIDENTS_JSON` | Optional JSON array for `/status` banners |
| Stripe / API signing keys | Billing and scan API auth (unchanged from product) |

---

## Constraints preserved (from engineering rules)

- Do not break **`/api/v1/scan`**, Stripe flows, extension/Telegram routes without explicit migration.
- Do not rename **`profiles.tier`** / **`saas_subscriptions.plan`** semantics.
- New user-facing tables use **RLS** where rows are tenant-scoped.
- Destructive dashboard actions use **confirm modals** (webhooks delete, etc.).

---

## Links

- Webhooks & batch & status API notes: **`docs/api.md`**
- Security audit log (example): **`docs/AUDIT_2026-04-17.md`**

---

*Last updated as part of Phase 7 documentation close-out.*
