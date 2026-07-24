-- Portfolio desk alerts (playbook Step 7).
-- Written by Helius webhook → /api/webhooks/helius-portfolio (and /api/webhooks/helius alias).
-- Read by GET /api/portfolio/alerts. Service role inserts; anon can read (desk polls).

CREATE TABLE IF NOT EXISTS public.portfolio_alerts (
  id text PRIMARY KEY,
  type text NOT NULL
    CHECK (type IN ('whale', 'liquidity', 'dev_wallet', 'smart_money', 'risk')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  token_symbol text,
  mint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_alerts_created_idx
  ON public.portfolio_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS portfolio_alerts_symbol_idx
  ON public.portfolio_alerts (token_symbol, created_at DESC);

ALTER TABLE public.portfolio_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolio_alerts_select ON public.portfolio_alerts;
CREATE POLICY portfolio_alerts_select ON public.portfolio_alerts
  FOR SELECT USING (true);

-- Inserts/updates go through SUPABASE_SERVICE_ROLE_KEY only (no public write policy).
