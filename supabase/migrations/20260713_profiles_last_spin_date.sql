-- Daily Spin the Wheel — one spin per 24h per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_spin_date TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_spin_date IS
  'UTC timestamp of last Spin the Wheel claim; next spin allowed after 24 hours.';

CREATE INDEX IF NOT EXISTS profiles_last_spin_date_idx
  ON public.profiles (last_spin_date)
  WHERE last_spin_date IS NOT NULL;
