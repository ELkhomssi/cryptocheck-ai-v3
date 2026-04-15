import { randomBytes } from 'crypto'
import { randomTokenUrlSafe, sha256Hex } from '@/lib/crypto/hash'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { SubscriptionTier } from '@/lib/types/tier'

/** Default schema version embedded in the secret prefix. */
export const INSTITUTIONAL_KEY_FORMAT_VERSION = 2

export type InstitutionalKeyPair = {
  /** Full secret — show only once at creation. */
  rawKey: string
  /** Stable public identifier for logs / dashboard (not the secret). */
  keyId: string
}

export type ApiKeyV2Record = {
  id: string
  key_id: string
  user_id: string
  version: number
  status: 'active' | 'rotating' | 'revoked'
  tier: SubscriptionTier
}

export type VerifiedApiKeyV2 = {
  schema: 'v2'
  keyUuid: string
  keyId: string
  userId: string
  keyVersion: number
  status: 'active' | 'rotating'
}

/**
 * Generates a v2 Sentinel key. Format: `cc_sentinel_{version}_{random}`.
 * Persist only `sha256Hex(rawKey)`; never store `rawKey`.
 */
export function generateInstitutionalKey(version: number = INSTITUTIONAL_KEY_FORMAT_VERSION): InstitutionalKeyPair {
  const randomSegment = randomTokenUrlSafe(32)
  const rawKey = `cc_sentinel_${version}_${randomSegment}`
  const keyId = `kid_${randomBytes(12).toString('hex')}`
  return { rawKey, keyId }
}

function keyPrefix(rawKey: string): string {
  return `${rawKey.slice(0, 24)}…`
}

/**
 * Insert a new v2 key; caller must display `rawKey` once then discard.
 */
export async function createInstitutionalApiKey(
  userId: string,
  name: string,
  opts?: { tier?: SubscriptionTier; version?: number }
): Promise<{ rawKey: string; key_id: string; id: string; key_prefix: string; name: string; created_at: string }> {
  const { rawKey, keyId } = generateInstitutionalKey(opts?.version)
  const hashed_secret = sha256Hex(rawKey)
  const tier = opts?.tier ?? 'free'
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys_v2')
    .insert({
      user_id: userId,
      key_id: keyId,
      name: name || 'Sentinel Key',
      key_prefix: keyPrefix(rawKey),
      hashed_secret,
      version: opts?.version ?? INSTITUTIONAL_KEY_FORMAT_VERSION,
      status: 'active',
      tier,
    })
    .select('id, key_id, key_prefix, name, created_at')
    .single()

  if (error) throw error
  return {
    id: data.id as string,
    key_id: data.key_id as string,
    key_prefix: data.key_prefix as string,
    name: data.name as string,
    created_at: data.created_at as string,
    rawKey,
  }
}

export async function listInstitutionalApiKeys(userId: string): Promise<
  Array<{
    id: string
    key_id: string
    key_prefix: string
    name: string
    status: string
    tier: string
    created_at: string
    last_used_at: string | null
    revoked_at: string | null
  }>
> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys_v2')
    .select('id, key_id, key_prefix, name, status, tier, created_at, last_used_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    key_id: string
    key_prefix: string
    name: string
    status: string
    tier: string
    created_at: string
    last_used_at: string | null
    revoked_at: string | null
  }>
}

/**
 * Verify raw key against api_keys_v2 (current or grace-period previous hash).
 */
export async function verifyApiKeyV2(raw: string): Promise<VerifiedApiKeyV2 | null> {
  const trimmed = raw.trim()
  const h = sha256Hex(trimmed)
  const sb = getSupabaseAdmin()

  const { data: byCurrent, error: e1 } = await sb
    .from('api_keys_v2')
    .select('id, key_id, user_id, version, status')
    .eq('hashed_secret', h)
    .is('revoked_at', null)
    .maybeSingle()

  if (!e1 && byCurrent && byCurrent.status !== 'revoked') {
    return {
      schema: 'v2',
      keyUuid: byCurrent.id as string,
      keyId: byCurrent.key_id as string,
      userId: byCurrent.user_id as string,
      keyVersion: Number(byCurrent.version),
      status: byCurrent.status as 'active' | 'rotating',
    }
  }

  const nowIso = new Date().toISOString()
  const { data: byPrev, error: e2 } = await sb
    .from('api_keys_v2')
    .select('id, key_id, user_id, version, status')
    .eq('previous_hashed_secret', h)
    .eq('status', 'rotating')
    .is('revoked_at', null)
    .gt('rotation_expires_at', nowIso)
    .maybeSingle()

  if (!e2 && byPrev) {
    return {
      schema: 'v2',
      keyUuid: byPrev.id as string,
      keyId: byPrev.key_id as string,
      userId: byPrev.user_id as string,
      keyVersion: Number(byPrev.version),
      status: 'rotating',
    }
  }

  return null
}

export async function touchApiKeyV2LastUsed(keyUuid: string): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb
    .from('api_keys_v2')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyUuid)
}

/**
 * Begin rotation: new material must be generated with `generateInstitutionalKey`, then call with new raw key.
 * Old secret remains valid until `rotation_expires_at`.
 */
export async function rotateInstitutionalApiKey(
  userId: string,
  keyUuid: string,
  newRawKey: string,
  rotationExpiresAt: Date
): Promise<{ rawKey: string; keyId: string } | null> {
  const sb = getSupabaseAdmin()
  const { data: row, error } = await sb
    .from('api_keys_v2')
    .select('id, hashed_secret, key_id')
    .eq('id', keyUuid)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !row) return null

  const newHash = sha256Hex(newRawKey.trim())
  const { error: up } = await sb
    .from('api_keys_v2')
    .update({
      previous_hashed_secret: row.hashed_secret,
      hashed_secret: newHash,
      key_prefix: keyPrefix(newRawKey.trim()),
      status: 'rotating',
      rotation_expires_at: rotationExpiresAt.toISOString(),
      version: INSTITUTIONAL_KEY_FORMAT_VERSION,
    })
    .eq('id', keyUuid)
    .eq('user_id', userId)

  if (up) throw up
  return { rawKey: newRawKey.trim(), keyId: row.key_id as string }
}

export async function finalizeInstitutionalRotation(userId: string, keyUuid: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys_v2')
    .update({
      previous_hashed_secret: null,
      status: 'active',
      rotation_expires_at: null,
    })
    .eq('id', keyUuid)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  return !!data
}

/** Hard kill: immediate revocation. */
export async function revokeInstitutionalApiKey(userId: string, keyUuid: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys_v2')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      previous_hashed_secret: null,
      rotation_expires_at: null,
    })
    .eq('id', keyUuid)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  return !!data
}
