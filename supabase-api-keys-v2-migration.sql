-- ============================================================
-- CryptoCheck AI — Institutional Mode v2 API keys (Sentinel)
-- Run in Supabase SQL Editor after review
-- v1 `api_keys` remains unchanged; v2 keys use cc_sentinel_* format
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys_v2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_id TEXT NOT NULL UNIQUE,
  hashed_secret TEXT NOT NULL,
  previous_hashed_secret TEXT,
  version INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL CHECK (status IN ('active', 'rotating', 'revoked')),
  rotation_expires_at TIMESTAMPTZ,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'institutional')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Sentinel Key',
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT api_keys_v2_current_hash_unique UNIQUE (hashed_secret),
  CONSTRAINT api_keys_v2_prev_hash_unique UNIQUE (previous_hashed_secret)
);

COMMENT ON TABLE api_keys_v2 IS 'Institutional v2 keys: hashed secrets only; rotation via previous_hashed_secret + rotation_expires_at';

CREATE INDEX IF NOT EXISTS idx_api_keys_v2_user_id ON api_keys_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_v2_active_hash ON api_keys_v2(hashed_secret)
  WHERE revoked_at IS NULL AND status IN ('active', 'rotating');
CREATE INDEX IF NOT EXISTS idx_api_keys_v2_prev_hash ON api_keys_v2(previous_hashed_secret)
  WHERE previous_hashed_secret IS NOT NULL;

ALTER TABLE api_keys_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own api keys v2"
  ON api_keys_v2 FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE security_logs
  ADD COLUMN IF NOT EXISTS api_key_v2_id UUID REFERENCES api_keys_v2(id) ON DELETE SET NULL;
