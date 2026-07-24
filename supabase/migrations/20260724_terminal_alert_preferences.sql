-- Terminal alert preferences + expanded portfolio_alerts types (Phase 10.7).

-- Expand CHECK on portfolio_alerts.type for fine-grained classifications.
ALTER TABLE public.portfolio_alerts DROP CONSTRAINT IF EXISTS portfolio_alerts_type_check;
ALTER TABLE public.portfolio_alerts
  ADD CONSTRAINT portfolio_alerts_type_check
  CHECK (type IN (
    'whale',
    'liquidity',
    'dev_wallet',
    'smart_money',
    'risk',
    'whale_buy',
    'whale_sell',
    'liquidity_added',
    'liquidity_removed',
    'mint_authority',
    'freeze_authority',
    'rug_risk',
    'smart_money_entry',
    'smart_money_exit',
    'new_listing',
    'large_holder_distribution',
    'new_token_launch'
  ));

-- Dedupe-friendly id is already PRIMARY KEY (text) on portfolio_alerts —
-- webhook + cron write signature:type[:mint] and upsert on conflict.

CREATE TABLE IF NOT EXISTS public.terminal_alert_preferences (
  user_id uuid NOT NULL,
  wallet text NOT NULL DEFAULT '',
  alert_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_type)
);

CREATE INDEX IF NOT EXISTS terminal_alert_preferences_wallet_idx
  ON public.terminal_alert_preferences (wallet)
  WHERE wallet <> '';

ALTER TABLE public.terminal_alert_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS terminal_alert_preferences_select ON public.terminal_alert_preferences;
CREATE POLICY terminal_alert_preferences_select ON public.terminal_alert_preferences
  FOR SELECT USING (true);

-- Inserts/updates go through SUPABASE_SERVICE_ROLE_KEY only (no public write policy).
