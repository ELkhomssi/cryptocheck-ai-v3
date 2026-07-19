-- Saved-You retention: DANGER blocks → graded rug outcomes → receipts.
-- Service-role writes. Users read own rows; public /saved/[id] reads by id.

CREATE TABLE IF NOT EXISTS user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mint text NOT NULL,
  symbol text,
  verdict text NOT NULL,
  score integer,
  evidence text,
  source text NOT NULL CHECK (source IN ('swap', 'snipe', 'manual')),
  intended_amount_usd numeric,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'rugged', 'survived', 'expired')),
  graded_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_blocks_pending_idx ON user_blocks (outcome, blocked_at ASC)
  WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS user_blocks_user_idx ON user_blocks (user_id, blocked_at DESC);
CREATE INDEX IF NOT EXISTS user_blocks_mint_idx ON user_blocks (mint);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_blocks_select_own ON user_blocks;
CREATE POLICY user_blocks_select_own ON user_blocks
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE TABLE IF NOT EXISTS saved_you (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES user_blocks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mint text NOT NULL,
  symbol text,
  blocked_at timestamptz NOT NULL,
  graded_at timestamptz NOT NULL DEFAULT now(),
  price_at_block numeric,
  price_at_grade numeric,
  drawdown_pct numeric,
  loss_avoided_estimate numeric,
  outcome_evidence text NOT NULL,
  explorer_url text,
  UNIQUE (block_id)
);

CREATE INDEX IF NOT EXISTS saved_you_user_idx ON saved_you (user_id, graded_at DESC);
CREATE INDEX IF NOT EXISTS saved_you_graded_idx ON saved_you (graded_at DESC);

ALTER TABLE saved_you ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_you_select ON saved_you;
CREATE POLICY saved_you_select ON saved_you
  FOR SELECT USING (true);

COMMENT ON TABLE user_blocks IS
  'DANGER gate near-misses (swap/snipe). Graded honestly — never fabricate saves.';
COMMENT ON TABLE saved_you IS
  'Proven saves: only created when Helius outcome shows a real rug. loss_avoided_estimate is an estimate.';
COMMENT ON COLUMN saved_you.loss_avoided_estimate IS
  'Estimate = intended_amount_usd × observed drawdown. Always label as estimate in UI.';
