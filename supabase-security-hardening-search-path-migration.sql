-- ============================================================
-- Security hardening: pin FUNCTION search_path
-- Run in Supabase SQL Editor
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.consume_credit(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.consume_credit(uuid) SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.handle_new_confirmed_user()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_confirmed_user() SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user_subscription()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user_subscription() SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.handle_scan_usage(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_scan_usage(uuid) SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.request_institutional_access(uuid,text,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.request_institutional_access(uuid, text, text) SET search_path = public, pg_temp';
  END IF;
END $$;
