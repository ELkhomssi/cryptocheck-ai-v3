-- LaunchLab event / fee / analytics ledger (extends token_launches).
-- Service-role writes. Public SELECT for creator dashboards (no secrets).

CREATE TABLE IF NOT EXISTS launch_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL REFERENCES token_launches(mint) ON DELETE CASCADE,
  status text NOT NULL,
  detail text,
  tracking_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS launch_status_logs_mint_idx
  ON launch_status_logs (mint, created_at DESC);

CREATE TABLE IF NOT EXISTS launch_fee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL,
  creator text NOT NULL,
  event_type text NOT NULL DEFAULT 'create_estimate',
  platform_create_fee_lamports bigint NOT NULL DEFAULT 0,
  network_fee_lamports bigint NOT NULL DEFAULT 0,
  rent_lamports bigint NOT NULL DEFAULT 0,
  metadata_cost_lamports bigint NOT NULL DEFAULT 0,
  total_lamports bigint NOT NULL DEFAULT 0,
  tracking_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS launch_fee_events_creator_idx
  ON launch_fee_events (creator, created_at DESC);
CREATE INDEX IF NOT EXISTS launch_fee_events_mint_idx
  ON launch_fee_events (mint, created_at DESC);

ALTER TABLE launch_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_fee_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS launch_status_logs_select ON launch_status_logs;
CREATE POLICY launch_status_logs_select ON launch_status_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS launch_fee_events_select ON launch_fee_events;
CREATE POLICY launch_fee_events_select ON launch_fee_events
  FOR SELECT USING (true);

COMMENT ON TABLE launch_status_logs IS
  'Append-only LaunchLab status trail (prepare/confirm/migrate). Service-role write.';
COMMENT ON TABLE launch_fee_events IS
  'Fee disclosure / collection events for LaunchLab. Create skim is 0; curve fees tracked separately in revenue ledger.';
