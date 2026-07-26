-- Phase 17 — Intelligence Core
-- New tables ONLY: timeline_events, user_memory, reports.
-- Do NOT duplicate agent_activity / portfolio_alerts / agent_predictions /
-- intelligence_score_snapshots / watchlist / terminal_orders.

-- ─── timeline_events (populated via triggers — zero app double-writes) ───
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id text NOT NULL,
  event_type text NOT NULL,
  summary text NOT NULL DEFAULT '',
  module text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timeline_events_created_idx
  ON public.timeline_events (created_at DESC);
CREATE INDEX IF NOT EXISTS timeline_events_module_idx
  ON public.timeline_events (module, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS timeline_events_source_uidx
  ON public.timeline_events (source_table, source_id, event_type);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timeline_events_select ON public.timeline_events;
CREATE POLICY timeline_events_select ON public.timeline_events
  FOR SELECT USING (true);

-- agent_activity → timeline
CREATE OR REPLACE FUNCTION public.intel_core_timeline_from_agent_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.timeline_events (source_table, source_id, event_type, summary, module, created_at)
  VALUES (
    'agent_activity',
    NEW.id::text,
    NEW.kind || ':' || NEW.status,
    COALESCE(NULLIF(TRIM(NEW.description), ''), NEW.agent_name || ' · ' || NEW.kind),
    CASE
      WHEN NEW.agent_id IN ('whale-analyst') THEN 'market'
      WHEN NEW.agent_id IN ('scam-investigator') THEN 'security'
      WHEN NEW.agent_id IN ('trading-coach') THEN 'trading'
      WHEN NEW.agent_id IN ('portfolio-manager', 'risk-manager') THEN 'portfolio'
      WHEN NEW.agent_id IN ('launch-advisor') THEN 'launch'
      WHEN NEW.agent_id IN ('research-analyst', 'market-strategist', 'news-intelligence') THEN 'research'
      ELSE NULL
    END,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (source_table, source_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timeline_agent_activity ON public.agent_activity;
CREATE TRIGGER trg_timeline_agent_activity
  AFTER INSERT ON public.agent_activity
  FOR EACH ROW
  EXECUTE FUNCTION public.intel_core_timeline_from_agent_activity();

-- portfolio_alerts → timeline
CREATE OR REPLACE FUNCTION public.intel_core_timeline_from_portfolio_alerts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.timeline_events (source_table, source_id, event_type, summary, module, created_at)
  VALUES (
    'portfolio_alerts',
    NEW.id::text,
    'alert:' || NEW.type,
    COALESCE(NULLIF(TRIM(NEW.title), ''), NEW.type) ||
      CASE WHEN NULLIF(TRIM(NEW.description), '') IS NULL THEN '' ELSE ' — ' || LEFT(NEW.description, 160) END,
    CASE
      WHEN NEW.type IN ('whale', 'smart_money', 'liquidity', 'new_listing', 'new_token_launch') THEN 'market'
      WHEN NEW.type IN ('risk', 'rug_risk', 'dev_wallet') THEN 'security'
      ELSE 'portfolio'
    END,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (source_table, source_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timeline_portfolio_alerts ON public.portfolio_alerts;
CREATE TRIGGER trg_timeline_portfolio_alerts
  AFTER INSERT ON public.portfolio_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.intel_core_timeline_from_portfolio_alerts();

-- terminal_orders status changes → timeline (INSERT + UPDATE of status)
CREATE OR REPLACE FUNCTION public.intel_core_timeline_from_terminal_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ev text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    ev := 'order:' || NEW.status;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    ev := 'order:' || NEW.status;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.timeline_events (source_table, source_id, event_type, summary, module, created_at)
  VALUES (
    'terminal_orders',
    NEW.id::text,
    ev,
    'Order ' || NEW.type || ' → ' || NEW.status ||
      ' (' || LEFT(NEW.input_mint, 6) || '…→' || LEFT(NEW.output_mint, 6) || '…)',
    'trading',
    COALESCE(NEW.updated_at, NEW.created_at, now())
  )
  ON CONFLICT (source_table, source_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timeline_terminal_orders_ins ON public.terminal_orders;
CREATE TRIGGER trg_timeline_terminal_orders_ins
  AFTER INSERT ON public.terminal_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.intel_core_timeline_from_terminal_orders();

DROP TRIGGER IF EXISTS trg_timeline_terminal_orders_upd ON public.terminal_orders;
CREATE TRIGGER trg_timeline_terminal_orders_upd
  AFTER UPDATE ON public.terminal_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.intel_core_timeline_from_terminal_orders();

-- ─── user_memory (interaction history — not a data warehouse) ───
CREATE TABLE IF NOT EXISTS public.user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  action_type text NOT NULL
    CHECK (action_type IN (
      'token_scanned',
      'token_ignored',
      'token_favorited',
      'wallet_tracked',
      'conversation_reference',
      'recommendation_shown',
      'alert_acknowledged'
    )),
  subject_type text NOT NULL DEFAULT 'unknown',
  subject_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_memory_user_created_idx
  ON public.user_memory (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_memory_action_idx
  ON public.user_memory (user_id, action_type, created_at DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_memory_select ON public.user_memory;
CREATE POLICY user_memory_select ON public.user_memory
  FOR SELECT USING (true);
-- Writes via service role only.

-- ─── reports (persisted briefs — not regenerated on every view) ───
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL
    CHECK (report_type IN ('morning_brief', 'daily', 'weekly', 'monthly')),
  user_id text,
  wallet_address text,
  title text NOT NULL,
  body text NOT NULL,
  insufficient_activity boolean NOT NULL DEFAULT false,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_type_created_idx
  ON public.reports (report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_wallet_idx
  ON public.reports (wallet_address, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_select ON public.reports;
CREATE POLICY reports_select ON public.reports
  FOR SELECT USING (true);
-- Writes via service role only.
