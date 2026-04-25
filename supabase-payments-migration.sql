-- ============================================================
-- CryptoCheck AI — Subscriptions & Payment Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Add is_elite to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_elite BOOLEAN DEFAULT false;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  plan_label TEXT,
  amount_sol NUMERIC,
  amount_usd NUMERIC,
  tx_signature TEXT UNIQUE,
  from_wallet TEXT,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns when table already exists from older migration
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_label TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_sol NUMERIC;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_usd NUMERIC;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tx_signature TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS from_wallet TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own subs" ON subscriptions;
CREATE POLICY "Users see own subs" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Index for duplicate check
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_tx ON subscriptions(tx_signature);
CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);

SELECT 'Payment schema ready!' AS status;
