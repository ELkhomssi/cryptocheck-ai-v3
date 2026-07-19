-- Pageview capture for human vs bot traffic audits (salted IP hash only).

CREATE TABLE IF NOT EXISTS page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  ip_address text,               -- salted SHA-256 hash, never raw IP
  user_agent text,
  referrer text,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Service-role inserts only. No SELECT for anon/authenticated (query via service role / SQL editor).
DROP POLICY IF EXISTS "service role can insert" ON page_views;
CREATE POLICY "service role can insert" ON page_views
  FOR INSERT TO service_role
  WITH CHECK (true);

COMMENT ON TABLE page_views IS
  'Middleware pageviews — session cookie pv_sid; ip_address is salted SHA-256 only.';
COMMENT ON COLUMN page_views.ip_address IS
  'SHA-256(raw_ip || IP_HASH_SALT) hex digest. Never store raw IP.';
