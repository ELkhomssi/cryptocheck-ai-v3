-- Premium personal-watch acceleration + Guardian Auto-Exit (non-custodial standing instruction).

-- Extend Saved-You sources for auto-exit saves.
ALTER TABLE public.user_blocks DROP CONSTRAINT IF EXISTS user_blocks_source_check;
ALTER TABLE public.user_blocks
  ADD CONSTRAINT user_blocks_source_check
  CHECK (source IN ('swap', 'snipe', 'manual', 'watch', 'auto_exit'));

-- Global Guardian defaults per user (premium feature).
CREATE TABLE IF NOT EXISTS public.guardian_auto_exit_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  max_slippage_bps integer NOT NULL DEFAULT 150
    CHECK (max_slippage_bps >= 10 AND max_slippage_bps <= 2000),
  min_proceeds_ratio numeric NOT NULL DEFAULT 0.85
    CHECK (min_proceeds_ratio > 0 AND min_proceeds_ratio <= 1),
  authorized_wallet text,
  authorized_at timestamptz,
  authorization_message text,
  authorization_sig text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.guardian_auto_exit_settings IS
  'Premium global Guardian Auto-Exit defaults. Wallet must sign standing instruction before arming.';

-- Per-position overrides (mint-level opt-in).
CREATE TABLE IF NOT EXISTS public.guardian_auto_exit_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  max_slippage_bps integer
    CHECK (max_slippage_bps IS NULL OR (max_slippage_bps >= 10 AND max_slippage_bps <= 2000)),
  min_proceeds_ratio numeric
    CHECK (min_proceeds_ratio IS NULL OR (min_proceeds_ratio > 0 AND min_proceeds_ratio <= 1)),
  authorized_wallet text,
  authorized_at timestamptz,
  authorization_message text,
  authorization_sig text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mint)
);

CREATE INDEX IF NOT EXISTS guardian_auto_exit_positions_user_idx
  ON public.guardian_auto_exit_positions (user_id, updated_at DESC);

ALTER TABLE public.guardian_auto_exit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_auto_exit_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guardian_settings_select_own ON public.guardian_auto_exit_settings;
CREATE POLICY guardian_settings_select_own ON public.guardian_auto_exit_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS guardian_settings_upsert_own ON public.guardian_auto_exit_settings;
CREATE POLICY guardian_settings_upsert_own ON public.guardian_auto_exit_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS guardian_positions_select_own ON public.guardian_auto_exit_positions;
CREATE POLICY guardian_positions_select_own ON public.guardian_auto_exit_positions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS guardian_positions_upsert_own ON public.guardian_auto_exit_positions;
CREATE POLICY guardian_positions_upsert_own ON public.guardian_auto_exit_positions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Audit trail for every auto-exit attempt (prepared / aborted / signed / failed).
CREATE TABLE IF NOT EXISTS public.guardian_auto_exit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint text NOT NULL,
  degrade_event_id uuid REFERENCES public.watch_degrade_events(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'aborted', 'awaiting_signature', 'completed', 'failed', 'killed')),
  reason text,
  wallet_address text,
  input_amount numeric,
  expected_output_usd numeric,
  price_impact_pct numeric,
  slippage_bps integer,
  swap_tx_base64 text,
  tx_signature text,
  platform_fee_bps integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS guardian_auto_exit_events_user_idx
  ON public.guardian_auto_exit_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS guardian_auto_exit_events_mint_idx
  ON public.guardian_auto_exit_events (mint, created_at DESC);

ALTER TABLE public.guardian_auto_exit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guardian_events_select_own ON public.guardian_auto_exit_events;
CREATE POLICY guardian_events_select_own ON public.guardian_auto_exit_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

COMMENT ON TABLE public.guardian_auto_exit_events IS
  'Guardian Auto-Exit audit log. Non-custodial — tx_signature only after user wallet signs.';
