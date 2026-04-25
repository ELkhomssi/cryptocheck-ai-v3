/*
  Enterprise institutional webhooks: lifecycle columns, delivery audit, retry queue, RLS for dashboard access.
  Run after supabase-webhooks-migration.sql
*/

ALTER TABLE institutional_webhooks
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS institutional_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES institutional_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  http_status INT,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inst_webhook_deliveries_webhook ON institutional_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_inst_webhook_deliveries_created ON institutional_webhook_deliveries(created_at DESC);

ALTER TABLE institutional_webhook_deliveries ENABLE ROW LEVEL SECURITY;

/* Retries are processed only with the service role (no policies = deny JWT access). */
CREATE TABLE IF NOT EXISTS institutional_webhook_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES institutional_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  pending_attempt INT NOT NULL,
  next_retry_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inst_webhook_retry_due
  ON institutional_webhook_retry_queue (next_retry_at);

ALTER TABLE institutional_webhook_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inst_webhook_deliveries_select_own ON institutional_webhook_deliveries;
DROP POLICY IF EXISTS inst_webhooks_select_own ON institutional_webhooks;
DROP POLICY IF EXISTS inst_webhooks_insert_own ON institutional_webhooks;
DROP POLICY IF EXISTS inst_webhooks_update_own ON institutional_webhooks;
DROP POLICY IF EXISTS inst_webhooks_delete_own ON institutional_webhooks;

/* institutional_webhooks: allow signed-in owners to manage their rows (admin/service role bypasses RLS). */
CREATE POLICY inst_webhook_deliveries_select_own
  ON institutional_webhook_deliveries FOR SELECT
  USING (
    webhook_id IN (
      SELECT id FROM institutional_webhooks WHERE user_id = auth.uid()
    )
  );

CREATE POLICY inst_webhooks_select_own
  ON institutional_webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY inst_webhooks_insert_own
  ON institutional_webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY inst_webhooks_update_own
  ON institutional_webhooks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY inst_webhooks_delete_own
  ON institutional_webhooks FOR DELETE
  USING (auth.uid() = user_id);
