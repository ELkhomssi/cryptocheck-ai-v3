-- ============================================================
-- CryptoCheck AI — Core v2 consolidated hardening migration
-- Date: 2026-04-29
--
-- Safety goals:
-- - Idempotent operations (CREATE ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION)
-- - Trigger safety (DROP TRIGGER IF EXISTS + CREATE TRIGGER)
-- - No destructive table drops
-- - SECURITY DEFINER search_path pinning
-- - Phase 2/3 hardening (auth guards + explicit service_role policies)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Profiles additive columns only
-- ------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_earnings_sol NUMERIC DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_elite BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_referral_code_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

-- ------------------------------------------------------------
-- Payments and subscriptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  plan_label TEXT,
  amount_sol NUMERIC,
  amount_usd NUMERIC,
  tx_signature TEXT UNIQUE,
  from_wallet TEXT,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount_sol NUMERIC;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount_usd NUMERIC;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS tx_signature TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS from_wallet TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_tx ON public.subscriptions(tx_signature);
CREATE INDEX IF NOT EXISTS idx_sub_user ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own subs" ON public.subscriptions;
CREATE POLICY "Users see own subs"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Needed by app/api/crypto/verify/route.ts
CREATE TABLE IF NOT EXISTS public.crypto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  plan TEXT,
  coin TEXT DEFAULT 'SOL',
  tx_signature TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_wallet_created
  ON public.crypto_payments (wallet_address, created_at DESC);

CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE
);

-- Constraint safety for signup inserts
ALTER TABLE public.saas_subscriptions
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.saas_subscriptions
      ADD CONSTRAINT saas_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE public.saas_subscriptions DROP CONSTRAINT IF EXISTS saas_subscriptions_tier_check;
ALTER TABLE public.saas_subscriptions
  ADD CONSTRAINT saas_subscriptions_tier_check
  CHECK (
    tier IN ('FREE', 'PRO', 'PRO_MAX_DEEP', 'PRO_MAX_ELITE', 'ENTERPRISE')
  );

ALTER TABLE public.saas_subscriptions DROP CONSTRAINT IF EXISTS saas_subscriptions_status_check;
ALTER TABLE public.saas_subscriptions
  ADD CONSTRAINT saas_subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'past_due', 'canceled'));

CREATE INDEX IF NOT EXISTS idx_saas_sub_user ON public.saas_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_saas_sub_status ON public.saas_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_saas_sub_stripe
  ON public.saas_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own saas subscription" ON public.saas_subscriptions;
CREATE POLICY "Users read own saas subscription"
  ON public.saas_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "No direct client writes saas subscription" ON public.saas_subscriptions;
CREATE POLICY "No direct client writes saas subscription"
  ON public.saas_subscriptions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- ------------------------------------------------------------
-- Credits / scans / fees
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  risk_score INTEGER,
  verdict TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  scan_id UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_history_scan_id_key ON public.scan_history(scan_id);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_mint TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  entry_price NUMERIC,
  exit_price NUMERIC,
  profit_sol NUMERIC,
  fee_sol NUMERIC,
  fee_rate NUMERIC DEFAULT 0.005,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_scan_usage(p_user_id UUID)
RETURNS TABLE(new_credits INTEGER, is_pro BOOLEAN) AS $$
DECLARE
  v_credits INTEGER;
  v_is_pro BOOLEAN;
BEGIN
  -- Phase 2 guard: prevent spending credits for another user.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT profiles.credits, profiles.is_pro
    INTO v_credits, v_is_pro
    FROM public.profiles AS profiles
    WHERE profiles.id = p_user_id
    FOR UPDATE;

  IF v_is_pro THEN
    RETURN QUERY SELECT v_credits, TRUE;
    RETURN;
  END IF;

  IF v_credits <= 0 THEN
    RAISE EXCEPTION 'No credits remaining';
  END IF;

  UPDATE public.profiles
    SET credits = credits - 1,
        total_scans = COALESCE(total_scans, 0) + 1,
        last_scan_at = now()
    WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
    VALUES (p_user_id, -1, 'scan', v_credits - 1);

  RETURN QUERY SELECT v_credits - 1, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own scans" ON public.scan_history;
CREATE POLICY "Users see own scans" ON public.scan_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users see own credits" ON public.credit_transactions;
CREATE POLICY "Users see own credits" ON public.credit_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users see own fees" ON public.performance_fees;
CREATE POLICY "Users see own fees" ON public.performance_fees
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Security logs / API keys
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  api_key_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  api_key_v2_id UUID
);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON public.security_logs(action);
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to security_logs" ON public.security_logs;
CREATE POLICY "No direct client access to security_logs"
  ON public.security_logs FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_hash_unique'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_hash_unique UNIQUE (key_hash);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active_hash
  ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own api keys" ON public.api_keys;
CREATE POLICY "Users read own api keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.api_keys_v2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_id TEXT NOT NULL UNIQUE,
  hashed_secret TEXT NOT NULL,
  previous_hashed_secret TEXT,
  version INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL CHECK (status IN ('active', 'rotating', 'revoked')),
  rotation_expires_at TIMESTAMPTZ,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'institutional')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Sentinel Key',
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_v2_current_hash_unique'
  ) THEN
    ALTER TABLE public.api_keys_v2
      ADD CONSTRAINT api_keys_v2_current_hash_unique UNIQUE (hashed_secret);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_v2_prev_hash_unique'
  ) THEN
    ALTER TABLE public.api_keys_v2
      ADD CONSTRAINT api_keys_v2_prev_hash_unique UNIQUE (previous_hashed_secret);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_keys_v2_user_id ON public.api_keys_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_v2_active_hash
  ON public.api_keys_v2(hashed_secret)
  WHERE revoked_at IS NULL AND status IN ('active', 'rotating');
CREATE INDEX IF NOT EXISTS idx_api_keys_v2_prev_hash
  ON public.api_keys_v2(previous_hashed_secret)
  WHERE previous_hashed_secret IS NOT NULL;
ALTER TABLE public.api_keys_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own api keys v2" ON public.api_keys_v2;
CREATE POLICY "Users read own api keys v2"
  ON public.api_keys_v2 FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_logs_api_key_id_fkey'
  ) THEN
    ALTER TABLE public.security_logs
      ADD CONSTRAINT security_logs_api_key_id_fkey
      FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_logs_api_key_v2_id_fkey'
  ) THEN
    ALTER TABLE public.security_logs
      ADD CONSTRAINT security_logs_api_key_v2_id_fkey
      FOREIGN KEY (api_key_v2_id) REFERENCES public.api_keys_v2(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- Webhooks and retry queue
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutional_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inst_webhooks_user ON public.institutional_webhooks(user_id);
ALTER TABLE public.institutional_webhooks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.institutional_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.institutional_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  http_status INT,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inst_webhook_deliveries_webhook
  ON public.institutional_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_inst_webhook_deliveries_created
  ON public.institutional_webhook_deliveries(created_at DESC);
ALTER TABLE public.institutional_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.institutional_webhook_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.institutional_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  pending_attempt INT NOT NULL,
  next_retry_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inst_webhook_retry_due
  ON public.institutional_webhook_retry_queue(next_retry_at);
ALTER TABLE public.institutional_webhook_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inst_webhook_deliveries_select_own ON public.institutional_webhook_deliveries;
CREATE POLICY inst_webhook_deliveries_select_own
  ON public.institutional_webhook_deliveries FOR SELECT TO authenticated
  USING (
    webhook_id IN (
      SELECT id FROM public.institutional_webhooks WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS inst_webhooks_select_own ON public.institutional_webhooks;
CREATE POLICY inst_webhooks_select_own
  ON public.institutional_webhooks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS inst_webhooks_insert_own ON public.institutional_webhooks;
CREATE POLICY inst_webhooks_insert_own
  ON public.institutional_webhooks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS inst_webhooks_update_own ON public.institutional_webhooks;
CREATE POLICY inst_webhooks_update_own
  ON public.institutional_webhooks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS inst_webhooks_delete_own ON public.institutional_webhooks;
CREATE POLICY inst_webhooks_delete_own
  ON public.institutional_webhooks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Watchlist / alerts / portfolio snapshots
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  last_risk_score INT,
  last_verdict TEXT,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, mint)
);

CREATE TABLE IF NOT EXISTS public.alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT,
  telegram_linked_at TIMESTAMPTZ,
  email_alerts_enabled BOOLEAN DEFAULT TRUE,
  telegram_alerts_enabled BOOLEAN DEFAULT FALSE,
  min_risk_change INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  old_risk_score INT,
  new_risk_score INT,
  old_verdict TEXT,
  new_verdict TEXT,
  delivery_channel TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  delivery_status TEXT
);

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  total_tokens INT,
  total_value_usd NUMERIC,
  risky_tokens_count INT,
  snapshot_data JSONB,
  scanned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watchlist_own ON public.watchlist;
CREATE POLICY watchlist_own ON public.watchlist
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS alert_prefs_own ON public.alert_preferences;
CREATE POLICY alert_prefs_own ON public.alert_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS alert_history_own_select ON public.alert_history;
CREATE POLICY alert_history_own_select ON public.alert_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS alert_history_service_insert ON public.alert_history;
CREATE POLICY alert_history_service_insert ON public.alert_history
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS portfolio_snapshots_own ON public.portfolio_snapshots;
CREATE POLICY portfolio_snapshots_own ON public.portfolio_snapshots
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_mint ON public.watchlist(mint);
CREATE INDEX IF NOT EXISTS idx_alert_history_user ON public.alert_history(user_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON public.portfolio_snapshots(user_id, scanned_at DESC);

-- ------------------------------------------------------------
-- Metrics / timings / disclaimer
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  unit TEXT,
  tags JSONB NOT NULL DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_time
  ON public.system_metrics(metric_name, collected_at DESC);
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.scan_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mint TEXT NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  helius_ms INTEGER,
  das_ms INTEGER,
  dex_ms INTEGER,
  analyze_ms INTEGER,
  total_ms INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_scan_timings_created ON public.scan_timings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_timings_user_created ON public.scan_timings(user_id, created_at DESC);
ALTER TABLE public.scan_timings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scan_timings_select_own ON public.scan_timings;
CREATE POLICY scan_timings_select_own
  ON public.scan_timings FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.disclaimer_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE (user_id, version)
);
CREATE INDEX IF NOT EXISTS idx_disclaimer_user ON public.disclaimer_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_disclaimer_version ON public.disclaimer_acknowledgments(version);
ALTER TABLE public.disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS disclaimer_own_read ON public.disclaimer_acknowledgments;
CREATE POLICY disclaimer_own_read
  ON public.disclaimer_acknowledgments FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS disclaimer_own_insert ON public.disclaimer_acknowledgments;
CREATE POLICY disclaimer_own_insert
  ON public.disclaimer_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS disclaimer_service_all ON public.disclaimer_acknowledgments;
CREATE POLICY disclaimer_service_all
  ON public.disclaimer_acknowledgments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Referrals
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id),
  plan TEXT NOT NULL,
  tx_signature TEXT,
  amount_sol NUMERIC NOT NULL,
  amount_usd NUMERIC,
  commission_rate NUMERIC DEFAULT 0.20,
  commission_sol NUMERIC NOT NULL,
  commission_usd NUMERIC,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_referrer ON public.commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_comm_status ON public.commissions(status);
CREATE INDEX IF NOT EXISTS idx_profiles_refcode ON public.profiles(referral_code);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own commissions" ON public.commissions;
CREATE POLICY "Users see own commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id);

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := LOWER(SUBSTR(MD5(NEW.id::text || NOW()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_code ON public.profiles;
CREATE TRIGGER trg_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

UPDATE public.profiles
SET referral_code = LOWER(SUBSTR(MD5(id::text || NOW()::text), 1, 8))
WHERE referral_code IS NULL;

-- ------------------------------------------------------------
-- Trading OS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trading_os_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  entry_price_usd NUMERIC,
  amount_ui NUMERIC,
  meta JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mint)
);

CREATE TABLE IF NOT EXISTS public.trading_os_tracked_wallets (
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

CREATE TABLE IF NOT EXISTS public.trading_os_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  tier_band TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  delivered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trading_os_leaderboard (
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

CREATE INDEX IF NOT EXISTS idx_trading_os_portfolios_user ON public.trading_os_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_os_alerts_user ON public.trading_os_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_os_leaderboard_period ON public.trading_os_leaderboard(period_start);

ALTER TABLE public.trading_os_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_os_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_os_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_os_tracked_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trading_os_portfolios_own" ON public.trading_os_portfolios;
CREATE POLICY "trading_os_portfolios_own"
  ON public.trading_os_portfolios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trading_os_alerts_own" ON public.trading_os_alerts;
CREATE POLICY "trading_os_alerts_own"
  ON public.trading_os_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trading_os_leaderboard_own" ON public.trading_os_leaderboard;
CREATE POLICY "trading_os_leaderboard_own"
  ON public.trading_os_leaderboard FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trading_os_tracked_wallets_read" ON public.trading_os_tracked_wallets;
CREATE POLICY "trading_os_tracked_wallets_read"
  ON public.trading_os_tracked_wallets FOR SELECT TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- Signals / AI usage
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.smart_money_wallets (
  address TEXT PRIMARY KEY,
  label TEXT,
  tier TEXT CHECK (tier IN ('whale', 'smart_money', 'insider')),
  historical_pnl_usd NUMERIC DEFAULT 0,
  win_rate_pct NUMERIC DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_smw_tier
  ON public.smart_money_wallets(tier) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS public.intelligence_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  verdict TEXT NOT NULL,
  confidence_pct INT,
  whale_count INT,
  net_flow_usd NUMERIC,
  ai_reasoning TEXT,
  patterns_matched JSONB,
  data_sources JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_signals_mint ON public.intelligence_signals(mint, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_type ON public.intelligence_signals(signal_type);

CREATE TABLE IF NOT EXISTS public.tracked_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  entry_signal_id UUID REFERENCES public.intelligence_signals(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  exited_at TIMESTAMPTZ,
  exit_signal_id UUID REFERENCES public.intelligence_signals(id),
  UNIQUE (user_id, mint)
);

CREATE TABLE IF NOT EXISTS public.signal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.intelligence_signals(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  entry_price_usd NUMERIC,
  exit_price_usd NUMERIC,
  peak_price_usd NUMERIC,
  drawdown_pct NUMERIC,
  pnl_pct NUMERIC,
  holding_hours INT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.relationship_graphs (
  mint TEXT PRIMARY KEY,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 minutes'
);

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.smart_money_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS smw_public_read ON public.smart_money_wallets;
CREATE POLICY smw_public_read
  ON public.smart_money_wallets FOR SELECT TO authenticated USING (active = TRUE);
DROP POLICY IF EXISTS signals_public_read ON public.intelligence_signals;
CREATE POLICY signals_public_read
  ON public.intelligence_signals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS perf_public_read ON public.signal_performance;
CREATE POLICY perf_public_read
  ON public.signal_performance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS graph_public_read ON public.relationship_graphs;
CREATE POLICY graph_public_read
  ON public.relationship_graphs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS track_own ON public.tracked_opportunities;
CREATE POLICY track_own
  ON public.tracked_opportunities FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS ai_usage_own_read ON public.ai_usage;
CREATE POLICY ai_usage_own_read
  ON public.ai_usage FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS svc_signals_all ON public.intelligence_signals;
CREATE POLICY svc_signals_all
  ON public.intelligence_signals FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS svc_perf_all ON public.signal_performance;
CREATE POLICY svc_perf_all
  ON public.signal_performance FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS svc_graph_all ON public.relationship_graphs;
CREATE POLICY svc_graph_all
  ON public.relationship_graphs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS svc_ai_all ON public.ai_usage;
CREATE POLICY svc_ai_all
  ON public.ai_usage FOR INSERT TO service_role
  WITH CHECK (true);

-- ------------------------------------------------------------
-- Explicit service_role-only policies (Phase 3)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.crypto_payments') IS NOT NULL THEN
    ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS sr_all_crypto_payments ON public.crypto_payments;
    CREATE POLICY sr_all_crypto_payments
      ON public.crypto_payments FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.institutional_webhook_retry_queue') IS NOT NULL THEN
    ALTER TABLE public.institutional_webhook_retry_queue ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS sr_all_institutional_webhook_retry_queue ON public.institutional_webhook_retry_queue;
    CREATE POLICY sr_all_institutional_webhook_retry_queue
      ON public.institutional_webhook_retry_queue FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.system_metrics') IS NOT NULL THEN
    ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS sr_all_system_metrics ON public.system_metrics;
    CREATE POLICY sr_all_system_metrics
      ON public.system_metrics FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_link_codes') IS NOT NULL THEN
    ALTER TABLE public.user_link_codes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS sr_all_user_link_codes ON public.user_link_codes;
    CREATE POLICY sr_all_user_link_codes
      ON public.user_link_codes FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------
-- SECURITY DEFINER search_path pinning
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.consume_credit(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.consume_credit(uuid) SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.handle_new_confirmed_user()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_confirmed_user() SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.handle_new_user_subscription()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user_subscription() SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.handle_scan_usage(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_scan_usage(uuid) SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.request_institutional_access(uuid,text,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.request_institutional_access(uuid, text, text) SET search_path = public, pg_temp';
  END IF;
END $$;

-- NOTE: consume_credit(uuid) body is environment-specific and not present in this repo.
-- Keep its existing body, but ensure auth.uid() guard exists in DB definition.
