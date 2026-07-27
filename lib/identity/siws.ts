/**
 * Phase 18 — Sign-In With Solana (SIWS) challenge + verify.
 * Presentation/identity only — reuses tweetnacl ed25519 verify (same as Guardian).
 */

import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildSiwsMessage, verifySiwsSignature } from '@/lib/identity/siws-message'

export { buildSiwsMessage, verifySiwsSignature }

const NONCE_TTL_MS = 10 * 60 * 1000

export async function issueSiwsChallenge(walletHint?: string | null): Promise<{
  nonce: string
  issuedAt: string
  expiresAt: string
}> {
  const nonce = randomBytes(24).toString('base64url')
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS)
  const admin = getSupabaseAdmin()
  const { error } = await admin.from('siws_nonces').insert({
    nonce,
    wallet_address: walletHint?.trim() || null,
    created_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  })
  if (error) throw new Error(`siws challenge unavailable: ${error.message}`)
  return {
    nonce,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

export async function consumeSiwsNonce(nonce: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('siws_nonces')
    .update({ consumed_at: now })
    .eq('nonce', nonce)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('nonce')
    .maybeSingle()
  if (error) {
    console.error('[siws] consume nonce', error.message)
    return false
  }
  return Boolean(data?.nonce)
}

export async function upsertIdentityForWallet(walletAddress: string): Promise<{
  userId: string
  walletAddress: string
  created: boolean
}> {
  const wallet = walletAddress.trim()
  if (wallet.length < 32) throw new Error('invalid wallet')
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from('identity_wallets')
    .select('user_id, wallet_address')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (existing?.user_id) {
    return {
      userId: String(existing.user_id),
      walletAddress: wallet,
      created: false,
    }
  }

  const { data: user, error: userErr } = await admin
    .from('identity_users')
    .insert({ display_name: null })
    .select('id')
    .single()
  if (userErr || !user?.id) {
    throw new Error(`identity user create failed: ${userErr?.message ?? 'unknown'}`)
  }
  const userId = String(user.id)

  const { error: walletErr } = await admin.from('identity_wallets').insert({
    user_id: userId,
    wallet_address: wallet,
    is_primary: true,
    verified_at: new Date().toISOString(),
  })
  if (walletErr) {
    throw new Error(`identity wallet link failed: ${walletErr.message}`)
  }

  await admin.from('entitlements').upsert(
    {
      user_id: userId,
      plan: 'free',
      status: 'active',
      source: 'system',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  return { userId, walletAddress: wallet, created: true }
}

export async function listWalletsForUser(userId: string): Promise<string[]> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('identity_wallets')
    .select('wallet_address')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return (data ?? []).map((r) => String(r.wallet_address))
}

export async function resolveUserIdFromWallet(walletAddress: string): Promise<string | null> {
  const wallet = walletAddress.trim()
  if (wallet.length < 32) return null
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('identity_wallets')
    .select('user_id')
    .eq('wallet_address', wallet)
    .maybeSingle()
  return data?.user_id ? String(data.user_id) : null
}

export function fingerprintWallet(wallet: string): string {
  return createHash('sha256').update(wallet.trim()).digest('hex').slice(0, 16)
}
