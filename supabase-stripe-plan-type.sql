-- Adds plan_type for Stripe webhook + product mapping (run in Supabase SQL editor)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_type TEXT;
