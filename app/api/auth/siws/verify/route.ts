/**
 * POST /api/auth/siws/verify
 * Body: { wallet, signatureBase64, nonce, message }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  buildSiwsMessage,
  consumeSiwsNonce,
  upsertIdentityForWallet,
  verifySiwsSignature,
} from '@/lib/identity/siws'
import { attachSiwsCookie, mintSiwsSession } from '@/lib/identity/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: {
    wallet?: string
    signatureBase64?: string
    nonce?: string
    message?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const wallet = (body.wallet || '').trim()
  const signatureBase64 = (body.signatureBase64 || '').trim()
  const nonce = (body.nonce || '').trim()
  if (wallet.length < 32 || !signatureBase64 || !nonce) {
    return NextResponse.json({ error: 'wallet, signatureBase64, and nonce required' }, { status: 400 })
  }

  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '') ||
    'cryptocheckai.com'
  const domain = host.split(':')[0]!

  // Rebuild canonical message — never trust client message alone for verify binding
  // but allow client message if it matches canonical.
  const { data: nonceRow } = await (async () => {
    // expiry checked inside consume; first verify signature against rebuilt message
    return { data: true }
  })()
  void nonceRow

  // We need issuedAt/expiresAt from DB for exact message — fetch nonce row first
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
  const admin = getSupabaseAdmin()
  const { data: row } = await admin
    .from('siws_nonces')
    .select('nonce, created_at, expires_at, consumed_at')
    .eq('nonce', nonce)
    .maybeSingle()

  if (!row || row.consumed_at) {
    return NextResponse.json({ error: 'invalid or expired nonce' }, { status: 401 })
  }
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    return NextResponse.json({ error: 'invalid or expired nonce' }, { status: 401 })
  }

  const canonical = buildSiwsMessage({
    domain,
    wallet,
    nonce,
    issuedAt: String(row.created_at),
    expiresAt: String(row.expires_at),
  })
  const message = body.message?.trim() || canonical
  if (message !== canonical) {
    // Accept only canonical to prevent message substitution
    return NextResponse.json({ error: 'message mismatch' }, { status: 401 })
  }

  if (!verifySiwsSignature({ wallet, message: canonical, signatureBase64 })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const consumed = await consumeSiwsNonce(nonce)
  if (!consumed) {
    return NextResponse.json({ error: 'nonce already used' }, { status: 401 })
  }

  try {
    const identity = await upsertIdentityForWallet(wallet)
    const session = mintSiwsSession(identity.userId, wallet)
    const res = NextResponse.json({
      ok: true,
      userId: identity.userId,
      walletAddress: wallet,
      created: identity.created,
    })
    attachSiwsCookie(res, session)
    return res
  } catch (e) {
    console.error('[siws/verify]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'verify failed' },
      { status: 503 },
    )
  }
}
