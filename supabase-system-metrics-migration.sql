-- ============================================================
-- System metrics (additive) — optional time-series for diagnostics.
-- Run in Supabase SQL editor. Service role used for reads/writes from backend jobs.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  unit TEXT,
  tags JSONB NOT NULL DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name_time ON system_metrics (metric_name, collected_at DESC);

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated — only service role / dashboard SQL inserts selects.

COMMENT ON TABLE system_metrics IS 'Time-series metrics for diagnostics (optional; collectors work without rows).';
