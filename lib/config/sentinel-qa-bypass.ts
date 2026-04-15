import type { VerifiedApiKeyV2 } from '@/lib/services/api-key-v2.service'

/**
 * Local/QA bypass for the fixed Sentinel test key (no `api_keys_v2` row).
 * Disabled when `NODE_ENV === 'production'` or `SENTINEL_QA_BYPASS_ENABLED=false`.
 */
export const SENTINEL_QA_BYPASS_RAW_KEY = 'cc_sentinel_test_khomssi_2026'

/** Synthetic row id — must not touch Supabase `api_keys_v2.last_used`. */
export const SENTINEL_QA_BYPASS_KEY_UUID = 'ffffffff-ffff-4fff-8fff-ffffffff0001'

/** Synthetic user id — `getUserSubscription` maps this to ENTERPRISE / runtime `institutional`. */
export const SENTINEL_QA_BYPASS_USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffff0002'

const SENTINEL_QA_BYPASS_PUBLIC_KID = 'kid_qa_khomssi_2026'

/** QA synthetic key is **never** honored in production builds. */
export function sentinelQaBypassEnabled(): boolean {
  if (process.env.SENTINEL_QA_BYPASS_ENABLED === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export function isSentinelQaBypassRawKey(raw: string): boolean {
  if (!sentinelQaBypassEnabled()) return false
  return raw.trim() === SENTINEL_QA_BYPASS_RAW_KEY
}

export function isSentinelQaBypassKeyUuid(id: string | undefined): boolean {
  if (!sentinelQaBypassEnabled() || !id) return false
  return id === SENTINEL_QA_BYPASS_KEY_UUID
}

export function isSentinelQaBypassUserId(userId: string): boolean {
  if (!sentinelQaBypassEnabled()) return false
  return userId === SENTINEL_QA_BYPASS_USER_ID
}

export function sentinelQaBypassVerification(): VerifiedApiKeyV2 {
  return {
    schema: 'v2',
    keyUuid: SENTINEL_QA_BYPASS_KEY_UUID,
    keyId: SENTINEL_QA_BYPASS_PUBLIC_KID,
    userId: SENTINEL_QA_BYPASS_USER_ID,
    keyVersion: 2,
    status: 'active',
  }
}

/**
 * `security_logs.user_id` FK to `auth.users` — use null for the synthetic QA user.
 */
export function securityLogUserIdForContext(ctx: {
  userId: string
  apiKeyId?: string
  via: 'api_key' | 'session'
}): string | null {
  if (ctx.via === 'api_key' && isSentinelQaBypassKeyUuid(ctx.apiKeyId)) return null
  return ctx.userId
}
