-- Phase 18 — optional owner_key on timeline_events for tenant-scoped reads.
-- Additive. Triggers updated to stamp wallet/user when available.

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS owner_key text;

CREATE INDEX IF NOT EXISTS timeline_events_owner_created_idx
  ON public.timeline_events (owner_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.intel_core_timeline_from_agent_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.timeline_events (source_table, source_id, event_type, summary, module, created_at, owner_key)
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
    COALESCE(NEW.created_at, now()),
    COALESCE(NULLIF(TRIM(NEW.wallet_address), ''), NULLIF(TRIM(NEW.user_id::text), ''))
  )
  ON CONFLICT (source_table, source_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;

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

  INSERT INTO public.timeline_events (source_table, source_id, event_type, summary, module, created_at, owner_key)
  VALUES (
    'terminal_orders',
    NEW.id::text,
    ev,
    'Order ' || NEW.type || ' → ' || NEW.status ||
      ' (' || LEFT(NEW.input_mint, 6) || '…→' || LEFT(NEW.output_mint, 6) || '…)',
    'trading',
    COALESCE(NEW.updated_at, NEW.created_at, now()),
    NULLIF(TRIM(NEW.wallet), '')
  )
  ON CONFLICT (source_table, source_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.timeline_events.owner_key IS
  'Phase 18 tenant scope — wallet or identity user_id when known; null = system/global.';
