-- AI Sniper audit trail. Every scan decision, blocked attempt, snipe attempt,
-- and confirmed swap is logged here so there is a verifiable history of WHY a
-- swap was (or was not) made. Public-verifiable high-conviction calls continue
-- to flow into signal_proof_calls via the Proof Engine.

CREATE TABLE IF NOT EXISTS signal_snipe_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signal_id text NOT NULL,
  mint text NOT NULL,
  symbol text,
  action text NOT NULL CHECK (action IN ('scan', 'candidate', 'blocked', 'attempt', 'swap')),
  allowed boolean NOT NULL DEFAULT false,
  neural_score integer,
  verdict text,
  red_flags text[] NOT NULL DEFAULT '{}',
  evidence_summary text,
  blocked_reason text,
  tx_signature text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signal_snipe_actions_created_idx ON signal_snipe_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS signal_snipe_actions_mint_idx ON signal_snipe_actions (mint);
CREATE INDEX IF NOT EXISTS signal_snipe_actions_action_idx ON signal_snipe_actions (action, created_at DESC);
CREATE INDEX IF NOT EXISTS signal_snipe_actions_user_idx ON signal_snipe_actions (user_id, created_at DESC);

ALTER TABLE signal_snipe_actions ENABLE ROW LEVEL SECURITY;

-- Users may read their own actions; market-wide (user_id NULL) rows are readable
-- by anyone for public verification. All writes are service-role only.
DROP POLICY IF EXISTS signal_snipe_actions_select ON signal_snipe_actions;
CREATE POLICY signal_snipe_actions_select ON signal_snipe_actions
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

COMMENT ON TABLE signal_snipe_actions IS
  'AI Sniper audit trail: scan/candidate/blocked/attempt/swap. Service-role write only.';
