/**
 * Institutional / Enterprise gate for POST `/api/v1/scan` (invoked from the route after auth).
 * (Next.js `middleware.ts` cannot access Supabase tier or raw API keys; security runs here.)
 */
export {
  assertScanTimestamp,
  assertScanSignature,
  assertEnterpriseIpAllowlist,
} from '@/lib/api/scan-request-security'
