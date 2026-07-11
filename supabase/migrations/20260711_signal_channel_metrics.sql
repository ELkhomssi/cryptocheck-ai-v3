-- Signal channel trust metrics for autonomous Telegram discovery / prioritization.
-- Feedback loop: gate outcomes → metrics → ingestion ranks by trust_score.

CREATE TABLE IF NOT EXISTS signal_channel_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL,
  platform text NOT NULL DEFAULT 'telegram'
    CHECK (platform IN ('telegram', 'twitter')),
  -- Rolling outcome counts (token signals only)
  signals_seen integer NOT NULL DEFAULT 0,
  signals_safe integer NOT NULL DEFAULT 0,
  signals_caution integer NOT NULL DEFAULT 0,
  signals_danger integer NOT NULL DEFAULT 0,
  signals_dropped integer NOT NULL DEFAULT 0,
  -- success_rate = safe / max(1, resolved) where resolved = safe+caution+danger
  success_rate numeric(6,4) NOT NULL DEFAULT 0.5000,
  -- Average ingest → assess latency (ms)
  latency_ms integer NOT NULL DEFAULT 0,
  latency_samples integer NOT NULL DEFAULT 0,
  -- Composite 0..100 used by channel-registry ordering
  trust_score numeric(6,2) NOT NULL DEFAULT 50.00,
  -- Engagement / hygiene (discovery inputs)
  audience_size integer,
  engagement_score numeric(6,2),
  last_signal_at timestamptz,
  last_scored_at timestamptz,
  auto_disabled boolean NOT NULL DEFAULT false,
  auto_disable_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signal_channel_metrics_platform_channel_key UNIQUE (platform, channel_id)
);

CREATE INDEX IF NOT EXISTS signal_channel_metrics_trust_idx
  ON signal_channel_metrics (platform, trust_score DESC)
  WHERE auto_disabled = false;

CREATE INDEX IF NOT EXISTS signal_channel_metrics_channel_idx
  ON signal_channel_metrics (channel_id);

COMMENT ON TABLE signal_channel_metrics IS
  'Per-channel trust metrics for Scout Discovery. Gate writes outcomes; ingestion ranks by trust_score.';

COMMENT ON COLUMN signal_channel_metrics.channel_id IS
  'Normalized public handle (@name) or numeric chat id string.';

COMMENT ON COLUMN signal_channel_metrics.success_rate IS
  'safe / (safe+caution+danger); defaults 0.5 until samples accumulate.';

COMMENT ON COLUMN signal_channel_metrics.trust_score IS
  '0..100 composite: success_rate, inverse danger rate, latency, engagement.';
