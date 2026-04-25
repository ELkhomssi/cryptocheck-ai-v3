-- ============================================================
-- Standardize SaaS tier labels (no new columns).
-- Accepts: FREE, PRO, PRO_MAX_DEEP, PRO_MAX_ELITE, ENTERPRISE
-- ============================================================

-- Drop legacy CHECK if present (name may vary by Postgres version)
ALTER TABLE saas_subscriptions DROP CONSTRAINT IF EXISTS saas_subscriptions_tier_check;

ALTER TABLE saas_subscriptions
  ADD CONSTRAINT saas_subscriptions_tier_check
  CHECK (
    tier IN (
      'FREE',
      'PRO',
      'PRO_MAX_DEEP',
      'PRO_MAX_ELITE',
      'ENTERPRISE'
    )
  );

COMMENT ON COLUMN saas_subscriptions.tier IS
  'SENTINEL tier: FREE < PRO < PRO_MAX_DEEP < PRO_MAX_ELITE < ENTERPRISE (ENTERPRISE unlocks Deep + Elite).';

-- profiles.tier is application-validated TEXT (no DB CHECK in most deployments).
-- Canonical values: same set as above + legacy lowercase slugs still accepted in app code.

-- Columns referenced by tier resolution / Stripe (safe if already present).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_elite BOOLEAN DEFAULT false;

-- Enterprise account (requested)
UPDATE profiles
SET
  tier = 'ENTERPRISE',
  is_pro = true,
  is_elite = true,
  plan = 'institutional',
  plan_type = coalesce(nullif(trim(plan_type), ''), 'enterprise')
WHERE lower(trim(email)) = lower(trim('elkhomssiabderrahim@gmail.com'));

-- Mirror SaaS row when it exists (optional; INSERT skipped if no auth user match)
UPDATE saas_subscriptions s
SET
  tier = 'ENTERPRISE',
  updated_at = now()
FROM profiles p
WHERE p.id = s.user_id
  AND lower(trim(p.email)) = lower(trim('elkhomssiabderrahim@gmail.com'));
