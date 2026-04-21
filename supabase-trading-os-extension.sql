-- ============================================================
-- Trading OS extension — additive only (no ALTER on billing tables).
-- Run in Supabase SQL editor after review.
-- ============================================================

CREATE TABLE IF NOT EXISTS trading_os_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  entry_price_usd NUMERIC,
  amount_ui NUMERIC,
  meta JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mint)
);

CREATE TABLE IF NOT EXISTS trading_os_tracked_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  total_trades INT NOT NULL DEFAULT 0,
  profitable_trades INT NOT NULL DEFAULT 0,
  win_rate NUMERIC,
  avg_roi NUMERIC,
  last_trade_at TIMESTAMPTZ,
  last_trade_sig TEXT,
  risk_score NUMERIC,
  meta JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet)
);

CREATE TABLE IF NOT EXISTS trading_os_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  tier_band TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  delivered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trading_os_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  roi_multiple NUMERIC NOT NULL DEFAULT 0,
  trade_speed_ms NUMERIC,
  entry_timing_score NUMERIC,
  score NUMERIC NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}',
  UNIQUE (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_trading_os_portfolios_user ON trading_os_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_os_alerts_user ON trading_os_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_os_leaderboard_period ON trading_os_leaderboard(period_start);

ALTER TABLE trading_os_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_os_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_os_leaderboard ENABLE ROW LEVEL SECURITY;

-- Idempotent: re-run safe after a partial apply (policy names are global per table).
DROP POLICY IF EXISTS "trading_os_portfolios_own" ON trading_os_portfolios;
CREATE POLICY "trading_os_portfolios_own"
  ON trading_os_portfolios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trading_os_alerts_own" ON trading_os_alerts;
CREATE POLICY "trading_os_alerts_own"
  ON trading_os_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trading_os_leaderboard_own" ON trading_os_leaderboard;
CREATE POLICY "trading_os_leaderboard_own"
  ON trading_os_leaderboard FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tracked_wallets: read-only for authenticated (writes via service role / future jobs)
ALTER TABLE trading_os_tracked_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trading_os_tracked_wallets_read" ON trading_os_tracked_wallets;
CREATE POLICY "trading_os_tracked_wallets_read"
  ON trading_os_tracked_wallets FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE trading_os_portfolios IS 'Per-user token positions + entry (PnL module).';
COMMENT ON TABLE trading_os_tracked_wallets IS 'Smart-money / copy-trading leaderboard inputs.';
COMMENT ON TABLE trading_os_alerts IS 'Event-driven alerts (in-app + webhook fan-out).';
COMMENT ON TABLE trading_os_leaderboard IS 'Gamification scores (ROI * speed_factor).';
