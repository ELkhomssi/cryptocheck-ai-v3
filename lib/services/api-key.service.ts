import { randomTokenUrlSafe, sha256Hex } from '@/lib/crypto/hash'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  isSentinelQaBypassRawKey,
  isSentinelQaBypassKeyUuid,
  sentinelQaBypassVerification,
} from '@/lib/config/sentinel-qa-bypass'
import {
  touchApiKeyV2LastUsed,
  verifyApiKeyV2,
  type VerifiedApiKeyV2,
} from '@/lib/services/api-key-v2.service'

const KEY_PREFIX = 'cc_live_'

export function generateApiKeyMaterial(): { secret: string; key_hash: string; key_prefix: string } {
  const secret = KEY_PREFIX + randomTokenUrlSafe(24)
  const key_hash = sha256Hex(secret)
  const key_prefix = `${secret.slice(0, 12)}…`
  return { secret, key_hash, key_prefix }
}

export type VerifiedApiKeyV1 = {
  schema: 'v1'
  keyId: string
  userId: string
}

export type VerifiedApiKey = VerifiedApiKeyV1 | VerifiedApiKeyV2

async function verifyApiKeyV1Only(raw: string): Promise<VerifiedApiKeyV1 | null> {
  const key_hash = sha256Hex(raw.trim())
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', key_hash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return null
  return { schema: 'v1', keyId: data.id as string, userId: data.user_id as string }
}

/**
 * Resolves v1 (`api_keys`) first, then v2 (`api_keys_v2`) — unchanged behavior for cc_live_* keys.
 */
export async function verifyApiKey(raw: string): Promise<VerifiedApiKey | null> {
  if (isSentinelQaBypassRawKey(raw)) return sentinelQaBypassVerification()
  const v1 = await verifyApiKeyV1Only(raw)
  if (v1) return v1
  const v2 = await verifyApiKeyV2(raw)
  return v2
}

export async function createApiKey(
  userId: string,
  name: string
): Promise<{
  id: string
  name: string
  key_prefix: string
  created_at: string
  secret: string
}> {
  const { secret, key_hash, key_prefix } = generateApiKeyMaterial()
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .insert({ user_id: userId, name: name || 'Default', key_prefix, key_hash })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error) throw error
  return { ...data, secret }
}

export async function touchApiKeyLastUsed(keyId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyId)
}

/** Updates last_used for either v1 uuid or v2 row uuid depending on verification result. */
export async function touchVerifiedApiKeyLastUsed(verified: VerifiedApiKey): Promise<void> {
  if (verified.schema === 'v2' && isSentinelQaBypassKeyUuid(verified.keyUuid)) return
  if (verified.schema === 'v2') {
    await touchApiKeyV2LastUsed(verified.keyUuid)
  } else {
    await touchApiKeyLastUsed(verified.keyId)
  }
}

export async function listApiKeys(userId: string) {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  return !!data
}
