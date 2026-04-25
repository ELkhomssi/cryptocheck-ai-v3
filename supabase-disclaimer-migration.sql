-- CryptoCheck AI — disclaimer acknowledgments (run in Supabase SQL editor)
-- Phase 1: table + RLS for versioned user acknowledgments

CREATE TABLE IF NOT EXISTS public.disclaimer_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE(user_id, version)
);

CREATE INDEX IF NOT EXISTS idx_disclaimer_user
  ON public.disclaimer_acknowledgments(user_id);

CREATE INDEX IF NOT EXISTS idx_disclaimer_version
  ON public.disclaimer_acknowledgments(version);

ALTER TABLE public.disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disclaimer_own_read"
  ON public.disclaimer_acknowledgments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "disclaimer_own_insert"
  ON public.disclaimer_acknowledgments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "disclaimer_service_all"
  ON public.disclaimer_acknowledgments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
