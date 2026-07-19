-- Track bonding-curve vs migrated lane for LaunchLab launches.
ALTER TABLE token_launches
  ADD COLUMN IF NOT EXISTS migration_status text NOT NULL DEFAULT 'curve';

ALTER TABLE token_launches
  ADD COLUMN IF NOT EXISTS migrated_at timestamptz;

ALTER TABLE token_launches
  ADD COLUMN IF NOT EXISTS migration_tx text;

CREATE INDEX IF NOT EXISTS token_launches_migration_status_idx
  ON token_launches (migration_status, created_at DESC);

COMMENT ON COLUMN token_launches.migration_status IS
  'curve = bonding curve live; migrate = threshold hit awaiting crank; migrated = CPMM live';
