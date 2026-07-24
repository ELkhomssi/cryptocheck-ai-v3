-- Terminal tracked orders (limit / DCA / TP / SL). Phase 10.8.
-- Fills are NOT automatic: cron marks trigger_hit when price condition is met;
-- user still signs Jupiter execution. status=filled only after a real signature.

CREATE TABLE IF NOT EXISTS public.terminal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  type text NOT NULL
    CHECK (type IN ('limit', 'dca', 'tp', 'sl')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'trigger_hit', 'filled', 'cancelled', 'expired')),
  input_mint text NOT NULL,
  output_mint text NOT NULL,
  amount double precision NOT NULL,
  trigger_price double precision,
  -- Optional: set when user signs the Jupiter swap after trigger_hit
  fill_signature text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS terminal_orders_wallet_created_idx
  ON public.terminal_orders (wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS terminal_orders_status_idx
  ON public.terminal_orders (status)
  WHERE status IN ('pending', 'trigger_hit');

ALTER TABLE public.terminal_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS terminal_orders_select ON public.terminal_orders;
CREATE POLICY terminal_orders_select ON public.terminal_orders
  FOR SELECT USING (true);

-- Inserts/updates go through SUPABASE_SERVICE_ROLE_KEY only (no public write policy).
