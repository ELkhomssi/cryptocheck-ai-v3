-- Phase 18 — Real identity (SIWS) + entitlements
-- Additive only. Does not alter Phase 17 engine tables' semantics beyond new FKs optional.

CREATE TABLE IF NOT EXISTS public.identity_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  auth_user_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.identity_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.identity_users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_wallets_wallet_unique UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS identity_wallets_user_idx ON public.identity_wallets (user_id);

CREATE TABLE IF NOT EXISTS public.siws_nonces (
  nonce text PRIMARY KEY,
  wallet_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS siws_nonces_expires_idx ON public.siws_nonces (expires_at);

-- Feature entitlements — shared source of truth for Stripe + future crypto rails
CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES public.identity_users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  current_period_end timestamptz,
  source text NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'stripe', 'crypto', 'manual')),
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entitlements_plan_status_idx ON public.entitlements (plan, status);

COMMENT ON TABLE public.identity_users IS 'Phase 18 stable user identity (SIWS).';
COMMENT ON TABLE public.identity_wallets IS 'One-to-many wallets per identity_users row.';
COMMENT ON TABLE public.entitlements IS 'Phase 18 Free/Pro entitlements — Stripe and crypto write here.';
