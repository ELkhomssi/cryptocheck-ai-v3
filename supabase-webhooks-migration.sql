-- Institutional webhook endpoints (POST targets for high-safety & risk-change events)
CREATE TABLE IF NOT EXISTS institutional_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inst_webhooks_user ON institutional_webhooks(user_id);

ALTER TABLE institutional_webhooks ENABLE ROW LEVEL SECURITY;
