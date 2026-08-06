-- Phase 19+ — durable Automation schedules (unattended recipe runs).
-- Cron /api/cron/automation-recipes claims due rows and runs real agents.
-- Money path unchanged: no auto-swaps; agents produce reports/signals only.

CREATE TABLE IF NOT EXISTS public.automation_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  wallet_address text,
  recipe_id text NOT NULL,
  agent_id text NOT NULL,
  action text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 1440
    CHECK (interval_minutes >= 60 AND interval_minutes <= 10080),
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text,
  last_error text,
  last_activity_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS automation_schedules_due_idx
  ON public.automation_schedules (enabled, next_run_at)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS automation_schedules_user_idx
  ON public.automation_schedules (user_id, created_at DESC);

ALTER TABLE public.automation_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_schedules_select ON public.automation_schedules;
CREATE POLICY automation_schedules_select ON public.automation_schedules
  FOR SELECT USING (true);

COMMENT ON TABLE public.automation_schedules IS
  'Pro Automation: unattended recipe schedules. Cron runs agents; never auto-signs swaps.';
