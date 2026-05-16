-- ============================================================
-- Security hardening: explicit service_role RLS policies
-- Run in Supabase SQL Editor
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.crypto_payments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS sr_all_crypto_payments ON public.crypto_payments';
    EXECUTE 'CREATE POLICY sr_all_crypto_payments ON public.crypto_payments FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.institutional_webhook_retry_queue') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.institutional_webhook_retry_queue ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS sr_all_institutional_webhook_retry_queue ON public.institutional_webhook_retry_queue';
    EXECUTE 'CREATE POLICY sr_all_institutional_webhook_retry_queue ON public.institutional_webhook_retry_queue FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.system_metrics') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS sr_all_system_metrics ON public.system_metrics';
    EXECUTE 'CREATE POLICY sr_all_system_metrics ON public.system_metrics FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_link_codes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_link_codes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS sr_all_user_link_codes ON public.user_link_codes';
    EXECUTE 'CREATE POLICY sr_all_user_link_codes ON public.user_link_codes FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
