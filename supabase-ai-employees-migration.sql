-- Phase 11 — AI Employees activity, predictions, and performance snapshots.
-- Prefix: agent_* per naming rules.

CREATE TABLE IF NOT EXISTS public.agent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  agent_name text NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('chat', 'report', 'signals', 'analysis', 'optimize', 'heartbeat', 'custom')),
  description text NOT NULL DEFAULT '',
  wallet_address text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_activity_created_idx
  ON public.agent_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_activity_agent_idx
  ON public.agent_activity (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_activity_status_idx
  ON public.agent_activity (status, created_at DESC)
  WHERE status = 'running';

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_activity_select ON public.agent_activity;
CREATE POLICY agent_activity_select ON public.agent_activity
  FOR SELECT USING (true);
-- Writes via service role only.

CREATE TABLE IF NOT EXISTS public.agent_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  kind text NOT NULL,
  subject text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'correct', 'incorrect', 'expired')),
  resolve_after timestamptz NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_predictions_pending_idx
  ON public.agent_predictions (resolve_after ASC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS agent_predictions_agent_idx
  ON public.agent_predictions (agent_id, created_at DESC);

ALTER TABLE public.agent_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_predictions_select ON public.agent_predictions;
CREATE POLICY agent_predictions_select ON public.agent_predictions
  FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.agent_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  score numeric,
  sample_size integer NOT NULL DEFAULT 0,
  calibrating boolean NOT NULL DEFAULT true,
  computed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_performance_snapshots_latest_uidx
  ON public.agent_performance_snapshots (agent_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS agent_performance_snapshots_agent_idx
  ON public.agent_performance_snapshots (agent_id, computed_at DESC);

ALTER TABLE public.agent_performance_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_performance_snapshots_select ON public.agent_performance_snapshots;
CREATE POLICY agent_performance_snapshots_select ON public.agent_performance_snapshots
  FOR SELECT USING (true);

-- Custom employee configs (user-defined; built-ins live in code).
CREATE TABLE IF NOT EXISTS public.agent_custom_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text,
  name text NOT NULL,
  role text NOT NULL,
  data_sources text[] NOT NULL DEFAULT '{}',
  action_type text NOT NULL
    CHECK (action_type IN ('chat', 'report', 'signals', 'analysis', 'optimize')),
  action_label text NOT NULL DEFAULT 'Run',
  instructions text NOT NULL DEFAULT '',
  icon_tone text NOT NULL DEFAULT 'accent',
  icon text NOT NULL DEFAULT 'Bot',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_custom_employees_user_idx
  ON public.agent_custom_employees (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_custom_employees_wallet_idx
  ON public.agent_custom_employees (wallet_address, created_at DESC);

ALTER TABLE public.agent_custom_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_custom_employees_select ON public.agent_custom_employees;
CREATE POLICY agent_custom_employees_select ON public.agent_custom_employees
  FOR SELECT USING (true);

-- Optimize Accept/Dismiss log for Portfolio Manager performance formula.
CREATE TABLE IF NOT EXISTS public.agent_suggestion_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  suggestion_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accept', 'dismiss')),
  wallet_address text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_suggestion_feedback_agent_idx
  ON public.agent_suggestion_feedback (agent_id, created_at DESC);

ALTER TABLE public.agent_suggestion_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_suggestion_feedback_select ON public.agent_suggestion_feedback;
CREATE POLICY agent_suggestion_feedback_select ON public.agent_suggestion_feedback
  FOR SELECT USING (true);
