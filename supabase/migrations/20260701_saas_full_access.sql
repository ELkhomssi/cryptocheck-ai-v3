-- FULL_ACCESS flag for simplified 2-tier Stripe subscriptions (Basic / Pro).
-- Set only by verified Stripe webhooks — never by client.

ALTER TABLE public.saas_subscriptions
  ADD COLUMN IF NOT EXISTS full_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE INDEX IF NOT EXISTS idx_saas_sub_full_access
  ON public.saas_subscriptions (user_id, full_access)
  WHERE full_access = true;

COMMENT ON COLUMN public.saas_subscriptions.full_access IS
  'Grants Deep Neural Scans, Alpha Feed, AI Auto-Sniper (access only — not auto-arm). Webhook-only.';
