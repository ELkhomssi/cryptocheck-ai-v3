-- Smart money wallets (seed + dynamic)
CREATE TABLE IF NOT EXISTS public.smart_money_wallets (
  address TEXT PRIMARY KEY,
  label TEXT,
  tier TEXT CHECK (tier IN ('whale','smart_money','insider')),
  historical_pnl_usd NUMERIC DEFAULT 0,
  win_rate_pct NUMERIC DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_smw_tier ON public.smart_money_wallets(tier) 
  WHERE active = TRUE;

-- Generated signals (audit trail)
CREATE TABLE IF NOT EXISTS public.intelligence_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- 'entry','exit','caution'
  verdict TEXT NOT NULL, -- 'bullish','bearish','neutral','caution'
  confidence_pct INT, -- data quality, NOT prediction confidence
  whale_count INT,
  net_flow_usd NUMERIC,
  ai_reasoning TEXT,
  patterns_matched JSONB,
  data_sources JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);

CREATE INDEX idx_signals_mint ON public.intelligence_signals(mint, generated_at DESC);
CREATE INDEX idx_signals_type ON public.intelligence_signals(signal_type);

-- User's tracked opportunities (watchlist, renamed from "positions")
CREATE TABLE IF NOT EXISTS public.tracked_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  entry_signal_id UUID REFERENCES intelligence_signals(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  exit_signal_id UUID REFERENCES intelligence_signals(id),
  UNIQUE(user_id, mint)
);

-- Signal performance tracking (for bankroll curve)
CREATE TABLE IF NOT EXISTS public.signal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES intelligence_signals(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  entry_price_usd NUMERIC,
  exit_price_usd NUMERIC,
  peak_price_usd NUMERIC,
  drawdown_pct NUMERIC,
  pnl_pct NUMERIC,
  holding_hours INT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationship graph cache
CREATE TABLE IF NOT EXISTS public.relationship_graphs (
  mint TEXT PRIMARY KEY,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes'
);

-- AI cost tracking
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE smart_money_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Public read for reference data
CREATE POLICY "smw_public_read" ON smart_money_wallets 
  FOR SELECT TO authenticated USING (active = TRUE);

CREATE POLICY "signals_public_read" ON intelligence_signals 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "perf_public_read" ON signal_performance 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "graph_public_read" ON relationship_graphs 
  FOR SELECT TO authenticated USING (true);

-- Per-user data
CREATE POLICY "track_own" ON tracked_opportunities 
  FOR ALL TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_usage_own_read" ON ai_usage 
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Service role writes
CREATE POLICY "svc_signals_all" ON intelligence_signals 
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_perf_all" ON signal_performance 
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_graph_all" ON relationship_graphs 
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_ai_all" ON ai_usage 
  FOR INSERT TO service_role WITH CHECK (true);
