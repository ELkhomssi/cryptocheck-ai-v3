-- ============================================================
-- CryptoCheck AI — Credits & Performance Fee Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add credits column to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 10;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0;

-- 2. Scan history table (tracks every scan for analytics)
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  risk_score INTEGER,
  verdict TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Credit transactions (audit trail for purchases + usage)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,          -- positive = purchase, negative = usage
  reason TEXT NOT NULL,              -- 'scan', 'signup_bonus', 'purchase', 'refill'
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Performance fee tracking (Whale Mode)
CREATE TABLE IF NOT EXISTS performance_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_mint TEXT NOT NULL,
  trade_type TEXT NOT NULL,          -- 'sniper', 'whale_copy'
  entry_price NUMERIC,
  exit_price NUMERIC,
  profit_sol NUMERIC,
  fee_sol NUMERIC,                   -- 0.5% of profit
  fee_rate NUMERIC DEFAULT 0.005,
  status TEXT DEFAULT 'pending',     -- 'pending', 'collected', 'waived'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Server-side function: safe credit deduction
CREATE OR REPLACE FUNCTION handle_scan_usage(p_user_id UUID)
RETURNS TABLE(new_credits INTEGER, is_pro BOOLEAN) AS $$
DECLARE
  v_credits INTEGER;
  v_is_pro BOOLEAN;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT profiles.credits, profiles.is_pro
    INTO v_credits, v_is_pro
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

  -- Pro users: unlimited
  IF v_is_pro THEN
    RETURN QUERY SELECT v_credits, TRUE;
    RETURN;
  END IF;

  -- Check credits
  IF v_credits <= 0 THEN
    RAISE EXCEPTION 'No credits remaining';
  END IF;

  -- Deduct
  UPDATE profiles
    SET credits = credits - 1,
        total_scans = COALESCE(total_scans, 0) + 1,
        last_scan_at = now()
    WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
    VALUES (p_user_id, -1, 'scan', v_credits - 1);

  RETURN QUERY SELECT v_credits - 1, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS policies
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own scans" ON scan_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own credits" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own fees" ON performance_fees
  FOR SELECT USING (auth.uid() = user_id);

-- Done!
SELECT 'CryptoCheck AI credit system ready!' AS status;
