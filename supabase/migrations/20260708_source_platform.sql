-- Multi-platform signal sources.
-- The (legacy-named) telegram_channels table now holds sources from multiple
-- platforms (telegram, twitter/X, …) discovered by the AI Signal Source Agent.
-- Telegram ingestion filters platform='telegram'; other platforms are enrolled
-- for future adapters.

ALTER TABLE telegram_channels
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'telegram';

-- Constrain to known platforms (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_channels_platform_check'
  ) THEN
    ALTER TABLE telegram_channels
      ADD CONSTRAINT telegram_channels_platform_check
      CHECK (platform IN ('telegram', 'twitter'));
  END IF;
END $$;

-- Uniqueness must be per-platform: the same handle can exist on multiple
-- platforms (e.g. @watcherguru on both Telegram and X).
ALTER TABLE telegram_channels DROP CONSTRAINT IF EXISTS telegram_channels_username_unique;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_channels_platform_username_key
  ON telegram_channels (platform, username);

CREATE INDEX IF NOT EXISTS telegram_channels_platform_enabled_idx
  ON telegram_channels (platform, enabled)
  WHERE enabled = true;

COMMENT ON COLUMN telegram_channels.platform IS
  'Source platform: telegram | twitter. Telegram ingestion reads platform=telegram only.';
