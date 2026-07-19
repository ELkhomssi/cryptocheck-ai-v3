-- Tokens launched through CryptoCheck Action Panel (Raydium LaunchLab + scanner gate).
-- Service-role writes only. Public SELECT so the dashboard "Launched on CryptoCheck" lane can read badges.

CREATE TABLE IF NOT EXISTS token_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL UNIQUE,
  creator text NOT NULL,
  name text NOT NULL DEFAULT '',
  ticker text NOT NULL DEFAULT '',
  description text,
  image_url text,
  supply text NOT NULL DEFAULT '0',
  total_sell_a text NOT NULL DEFAULT '0',
  total_fund_raising_b text NOT NULL DEFAULT '0',
  sol_target numeric NOT NULL DEFAULT 0,
  curve_type text NOT NULL DEFAULT 'justsendit',
  platform_id text NOT NULL,
  pool_id text,
  tx_signature text NOT NULL,
  safety_score integer,
  risk_score integer,
  verdict text,
  badge text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_launches_created_idx ON token_launches (created_at DESC);
CREATE INDEX IF NOT EXISTS token_launches_creator_idx ON token_launches (creator, created_at DESC);
CREATE INDEX IF NOT EXISTS token_launches_verdict_idx ON token_launches (verdict, created_at DESC);

ALTER TABLE token_launches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS token_launches_select ON token_launches;
CREATE POLICY token_launches_select ON token_launches
  FOR SELECT USING (true);

COMMENT ON TABLE token_launches IS
  'CryptoCheck LaunchLab launches: platformId-verified, Neural V4 scanned. Service-role write only. Badges are real scan verdicts (SAFE/CAUTION/DANGER) — flagged tokens are labeled, not hidden.';
