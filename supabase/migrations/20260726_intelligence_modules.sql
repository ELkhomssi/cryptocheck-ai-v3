-- Phase 16 — Intelligence Modules score history + daily memory.
-- Prefix: intelligence_* per naming rules.

CREATE TABLE IF NOT EXISTS public.intelligence_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL
    CHECK (module_id IN ('market', 'security', 'trading', 'portfolio', 'launch', 'research')),
  score numeric,
  calibrating boolean NOT NULL DEFAULT true,
  avg_worker_performance numeric,
  provider_uptime_pct numeric,
  data_freshness_pct numeric,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_score_snapshots_module_idx
  ON public.intelligence_score_snapshots (module_id, computed_at DESC);

ALTER TABLE public.intelligence_score_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intelligence_score_snapshots_select ON public.intelligence_score_snapshots;
CREATE POLICY intelligence_score_snapshots_select ON public.intelligence_score_snapshots
  FOR SELECT USING (true);
-- Writes via service role only.

CREATE TABLE IF NOT EXISTS public.intelligence_module_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL
    CHECK (module_id IN ('market', 'security', 'trading', 'portfolio', 'launch', 'research')),
  memory_day date NOT NULL,
  yesterday_text text NOT NULL DEFAULT '',
  yesterday_idle boolean NOT NULL DEFAULT true,
  yesterday_source_id text,
  today_text text NOT NULL DEFAULT '',
  today_idle boolean NOT NULL DEFAULT true,
  tomorrow_text text,
  tomorrow_prediction_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, memory_day)
);

CREATE INDEX IF NOT EXISTS intelligence_module_memory_day_idx
  ON public.intelligence_module_memory (memory_day DESC);

ALTER TABLE public.intelligence_module_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intelligence_module_memory_select ON public.intelligence_module_memory;
CREATE POLICY intelligence_module_memory_select ON public.intelligence_module_memory
  FOR SELECT USING (true);
-- Writes via service role only.
