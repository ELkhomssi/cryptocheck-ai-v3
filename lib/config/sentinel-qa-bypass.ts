import type { VerifiedApiKeyV2 } from '@/lib/services/api-key-v2.service'

/**
 * Local/QA bypass for a dev-only Sentinel test key (no `api_keys_v2` row).
 *
 * Fail-closed: the bypass is OFF by default and only activates when ALL of:
 *   Guard A — `NODE_ENV !== 'production'`                (never in prod)
 *   Guard B — `SENTINEL_QA_BYPASS_ENABLED === 'true'`    (explicit opt-in)
 *   Guard C — `SENTINEL_QA_BYPASS_KEY` is set & non-empty (no key → no bypass)
 *
 * The raw test-key value is NEVER hardcoded in source. Operators must set it
 * via the environment; any missing condition disables the bypass completely,
 * regardless of the other flags.
 */

export const SENTINEL_QA_BYPASS_KEY_UUID = 'ffffffff-ffff-4fff-8fff-ffffffff0001'
export const SENTINEL_QA_BYPASS_USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffff0002'
const SENTINEL_QA_BYPASS_PUBLIC_KID = 'kid_qa_khomssi_2026'

function qaBypassRawKey(): string | null {
  const raw = process.env.SENTINEL_QA_BYPASS_KEY
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function sentinelQaBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.SENTINEL_QA_BYPASS_ENABLED !== 'true') return false
  if (qaBypassRawKey() === null) return false
  return true
}

if (sentinelQaBypassEnabled()) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SECURITY] QA bypass enabled. This must never run in production.'
  )
}

export function isSentinelQaBypassRawKey(raw: string): boolean {
  if (!sentinelQaBypassEnabled()) return false
  const expected = qaBypassRawKey()
  if (expected === null) return false
  return raw.trim() === expected
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
