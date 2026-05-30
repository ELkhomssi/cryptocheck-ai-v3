# Latency regression check (Phase 0 → Final)

**Audit date:** 2026-05-28  
**Target SLA (plan):** P50 uncached risk assessment ≤ 50ms (fast mode); full institutional path separate.

## Execution status

| Step | Status |
|------|--------|
| Baseline SQL defined | ✅ `docs/scan-timings-baseline.sql` |
| Supabase query executed in this audit | ❌ No `.env` / `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` in workspace |
| Phase 0 snapshot file | ❌ Not committed (`docs/latency-phase0.json` missing) |
| Post-migration fast path (`/api/b2b/v1/risk?mode=fast`) | ❌ Route not implemented |

## How to run locally

```bash
# Load env, then psql or Supabase dashboard → SQL → paste scan-timings-baseline.sql
source .env.local 2>/dev/null || true
# Or use existing dashboard helper (per-user, uncached only):
# lib/services/usage-analytics.service.ts → getScanTimingLatencyStats(userId, days)
```

Save results:

```bash
# Example: export Phase 0 / Final JSON for diff
psql "$DATABASE_URL" -f docs/scan-timings-baseline.sql -o docs/latency-snapshot-final.txt
```

## Expected comparison matrix

| Bucket | Phase 0 (typical) | Final (if migration OK) | Pass criterion |
|--------|-------------------|-------------------------|----------------|
| **cached** P50 | 15–80 ms | ≤ Phase 0 or lower | No regression |
| **uncached** P50 (full `/api/v1/scan`) | 400–2500 ms | Still high without worker | Flag if unchanged |
| **uncached** P50 (fast/B2B) | N/A | 50–120 ms on dedicated worker | ≤ 100 ms stretch goal |

## Bottleneck flag (architecture — current code)

Even without DB numbers, the **dominant uncached latency** on `POST /api/v1/scan` is structural:

1. **Parallel enrichment** — `enrichScanBodyFromChain` + DexScreener (`execute-scan.ts`).
2. **Post-pipeline canonical overlay** — `canonicalScan(mint)` after `runInstitutionalScan` (`app/api/v1/scan/route.ts`).
3. **Serverless cold start** — Vercel/Next `nodejs` runtime.
4. **No B2B fast path** — cannot skip canonical merge.

**Conclusion:** P50 uncached **cannot improve** until:

- Scan Gateway exposes `mode=fast` (pipeline + cache only).
- Canonical intelligence moves async (webhook / materialized index).
- Optional: scan-worker off Vercel.

## Instrumentation reference

Writes: `lib/telemetry/scan-timing.ts` → `scan_timings` columns `helius_ms`, `dex_ms`, `analyze_ms`, `total_ms`, `cached`.

Read: `getScanTimingLatencyStats()` in `lib/services/usage-analytics.service.ts` (dashboard; filters `cached = false` only).
