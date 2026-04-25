-- Scan pipeline performance telemetry (service role inserts from API; optional user-scoped reads for dashboard)
CREATE TABLE IF NOT EXISTS public.scan_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mint TEXT NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  helius_ms INTEGER,
  das_ms INTEGER,
  dex_ms INTEGER,
  analyze_ms INTEGER,
  total_ms INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_timings_created ON public.scan_timings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_timings_user_created ON public.scan_timings (user_id, created_at DESC);

ALTER TABLE public.scan_timings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read only their own timing rows (dashboard usage).
CREATE POLICY "scan_timings_select_own"
  ON public.scan_timings
  FOR SELECT
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for anon/authenticated clients — API uses service role.

COMMENT ON TABLE public.scan_timings IS 'P50/P95 instrumentation for POST /api/v1/scan; written by service role only.';
