-- ============================================================
-- CryptoCheck AI — SENTINEL SaaS recurring subscriptions
-- NOTE: Legacy `subscriptions` (supabase-payments-migration.sql) stores
-- on-chain SOL payment rows. This table is the canonical Stripe/recurring bill.
-- ============================================================

CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('FREE', 'PRO', 'ENTERPRISE')),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  CONSTRAINT saas_subscriptions_user_id_key UNIQUE (user_id)
);

COMMENT ON TABLE saas_subscriptions IS 'SENTINEL Engine — recurring SaaS entitlement (FREE/PRO/ENTERPRISE). Distinct from legacy crypto `subscriptions` payment receipts.';

CREATE INDEX IF NOT EXISTS idx_saas_sub_user ON saas_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_saas_sub_status ON saas_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_saas_sub_stripe ON saas_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE saas_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own saas subscription"
  ON saas_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Server-side writes only (service role); no INSERT/UPDATE from client by default
CREATE POLICY "No direct client writes saas subscription"
  ON saas_subscriptions FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
