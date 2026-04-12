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

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own subs" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Index for duplicate check
CREATE INDEX IF NOT EXISTS idx_sub_tx ON subscriptions(tx_signature);
CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);

SELECT 'Payment schema ready!' AS status;
