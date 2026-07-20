-- Execution OMS audit + capital book (CryptoCheck AI)
-- Prefix: token_exec_* / signal_exec_* domain naming per project rules.
-- Immutable audit: updates only append phase events; terminal rows are insert-once finalize.

CREATE TABLE IF NOT EXISTS token_exec_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  mint TEXT NOT NULL,
  symbol TEXT,
  source TEXT NOT NULL CHECK (source IN (
    'launchlab', 'smart_alpha', 'sniper', 'manual', 'api', 'guardian_exit'
  )),
  strategy TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  amount_sol DOUBLE PRECISION,
  max_slippage_bps INTEGER NOT NULL DEFAULT 100,
  client_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_exec_opportunities_user_created_idx
  ON token_exec_opportunities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS token_exec_opportunities_mint_idx
  ON token_exec_opportunities (mint);

CREATE TABLE IF NOT EXISTS token_exec_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL REFERENCES token_exec_opportunities (opportunity_id),
  user_id UUID NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_json JSONB,
  simulation_json JSONB,
  safety_json JSONB,
  capital_json JSONB,
  jito_json JSONB,
  submit_json JSONB,
  signature TEXT,
  realized_pnl_sol DOUBLE PRECISION,
  latency_json JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_exec_audits_opp_idx ON token_exec_audits (opportunity_id);
CREATE INDEX IF NOT EXISTS token_exec_audits_user_created_idx
  ON token_exec_audits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS token_exec_audits_signature_idx
  ON token_exec_audits (signature) WHERE signature IS NOT NULL;

-- Append-only phase log (immutable trail)
CREATE TABLE IF NOT EXISTS token_exec_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES token_exec_audits (id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_exec_audit_events_audit_idx
  ON token_exec_audit_events (audit_id, created_at);

-- Per-user capital policy overrides (defaults live in code / Redis)
CREATE TABLE IF NOT EXISTS token_exec_capital_policies (
  user_id UUID PRIMARY KEY,
  max_sol_per_trade DOUBLE PRECISION NOT NULL DEFAULT 1,
  max_exposure_per_token_sol DOUBLE PRECISION NOT NULL DEFAULT 2,
  max_exposure_per_wallet_sol DOUBLE PRECISION NOT NULL DEFAULT 10,
  max_daily_loss_sol DOUBLE PRECISION NOT NULL DEFAULT 5,
  max_drawdown_pct DOUBLE PRECISION NOT NULL DEFAULT 15,
  max_simultaneous_positions INTEGER NOT NULL DEFAULT 5,
  max_slippage_bps INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE token_exec_audits IS
  'OMS audit for non-custodial Solana execution — signatures are user-signed only';
