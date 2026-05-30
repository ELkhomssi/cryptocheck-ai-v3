-- Phase 0 / Final latency regression baseline for scan_timings
-- Run in Supabase SQL editor or psql with service-role access.
-- Table: public.scan_timings (see supabase-scan-timings-migration.sql)

-- Window: last 7 days (adjust as needed)
WITH windowed AS (
  SELECT *
  FROM public.scan_timings
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
cached AS (
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms) AS p50_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms) AS p95_ms,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY total_ms) AS p99_ms,
    AVG(total_ms)::int AS avg_ms,
    COUNT(*)::int AS n,
    AVG(helius_ms)::int AS avg_helius_ms,
    AVG(dex_ms)::int AS avg_dex_ms,
    AVG(analyze_ms)::int AS avg_analyze_ms
  FROM windowed
  WHERE cached = true
),
uncached AS (
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms) AS p50_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms) AS p95_ms,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY total_ms) AS p99_ms,
    AVG(total_ms)::int AS avg_ms,
    COUNT(*)::int AS n,
    AVG(helius_ms)::int AS avg_helius_ms,
    AVG(dex_ms)::int AS avg_dex_ms,
    AVG(analyze_ms)::int AS avg_analyze_ms
  FROM windowed
  WHERE cached = false
)
SELECT 'cached' AS bucket, * FROM cached
UNION ALL
SELECT 'uncached' AS bucket, * FROM uncached;

-- Bottleneck hint: if uncached p50 unchanged but avg_helius_ms high → enrichment/RPC
-- If avg_analyze_ms high → pipeline/scoring; if total_ms >> helius+dex+analyze → route overhead (canonical merge, auth)
