-- ============================================================
-- CryptoCheck AI — Referral System Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Add referral columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_earnings_sol NUMERIC DEFAULT 0;

-- Auto-generate referral codes for existing users
UPDATE profiles SET referral_code = LOWER(SUBSTR(MD5(id::text || NOW()::text), 1, 8)) WHERE referral_code IS NULL;

-- Commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id),
  plan TEXT NOT NULL,
  tx_signature TEXT,
  amount_sol NUMERIC NOT NULL,
  amount_usd NUMERIC,
  commission_rate NUMERIC DEFAULT 0.20,
  commission_sol NUMERIC NOT NULL,
  commission_usd NUMERIC,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own commissions" ON commissions FOR SELECT USING (auth.uid() = referrer_id);

CREATE INDEX IF NOT EXISTS idx_comm_referrer ON commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_comm_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_profiles_refcode ON profiles(referral_code);

-- Function to auto-generate referral code on new user
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := LOWER(SUBSTR(MD5(NEW.id::text || NOW()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_code ON profiles;
CREATE TRIGGER trg_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

SELECT 'Referral schema ready!' AS status;
