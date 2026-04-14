-- ============================================================
-- CryptoCheck AI — Institutional API keys & security audit log
-- Run in Supabase SQL Editor after review
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT api_keys_hash_unique UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Optional: users can read own keys via authenticated client (service role bypasses RLS in API routes)
CREATE POLICY "Users read own api keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON security_logs(action);

ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- No client-side insert; server uses service role only
CREATE POLICY "No direct client access to security_logs"
  ON security_logs FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
