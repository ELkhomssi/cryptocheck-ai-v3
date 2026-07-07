-- Public Telegram channel allowlist for signal ingestion (Railway telegram-monitor).
-- Workers read enabled rows on boot + every 5 min; no redeploy needed to add channels.

CREATE TABLE IF NOT EXISTS telegram_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_channels_username_unique UNIQUE (username)
);

CREATE INDEX IF NOT EXISTS telegram_channels_enabled_idx
  ON telegram_channels (enabled)
  WHERE enabled = true;

COMMENT ON TABLE telegram_channels IS
  'Public Telegram channels monitored by services/ingestion. username: @handle or numeric id string.';
