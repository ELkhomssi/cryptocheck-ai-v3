-- Watchlist: tokens a user wants to monitor
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  last_risk_score INT,
  last_verdict TEXT,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mint)
);

-- Alert preferences per user
CREATE TABLE IF NOT EXISTS public.alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT,
  telegram_linked_at TIMESTAMPTZ,
  email_alerts_enabled BOOLEAN DEFAULT TRUE,
  telegram_alerts_enabled BOOLEAN DEFAULT FALSE,
  min_risk_change INT DEFAULT 10, -- minimum risk delta to trigger alert
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history: what alerts have been sent
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  old_risk_score INT,
  new_risk_score INT,
  old_verdict TEXT,
  new_verdict TEXT,
  delivery_channel TEXT, -- 'email', 'telegram'
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status TEXT -- 'sent', 'failed'
);

-- Portfolio snapshots: cached scan of a wallet
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  total_tokens INT,
  total_value_usd NUMERIC,
  risky_tokens_count INT,
  snapshot_data JSONB, -- full scan results
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_own" ON public.watchlist
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "alert_prefs_own" ON public.alert_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "alert_history_own_select" ON public.alert_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "portfolio_snapshots_own" ON public.portfolio_snapshots
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can write alert_history
CREATE POLICY "alert_history_service_insert" ON public.alert_history
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_mint ON public.watchlist(mint);
CREATE INDEX IF NOT EXISTS idx_alert_history_user ON public.alert_history(user_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON public.portfolio_snapshots(user_id, scanned_at DESC);
