import { randomTokenUrlSafe, sha256Hex } from '@/lib/crypto/hash'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const KEY_PREFIX = 'cc_live_'

export function generateApiKeyMaterial(): { secret: string; key_hash: string; key_prefix: string } {
  const secret = KEY_PREFIX + randomTokenUrlSafe(24)
  const key_hash = sha256Hex(secret)
  const key_prefix = `${secret.slice(0, 12)}…`
  return { secret, key_hash, key_prefix }
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

export async function verifyApiKey(raw: string): Promise<{ keyId: string; userId: string } | null> {
  const key_hash = sha256Hex(raw.trim())
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', key_hash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return null
  return { keyId: data.id as string, userId: data.user_id as string }
}

export async function touchApiKeyLastUsed(keyId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyId)
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
