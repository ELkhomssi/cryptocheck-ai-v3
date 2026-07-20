import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import {
  buildGuardianAuthMessage,
  guardianAuthExpiresAt,
  verifyGuardianWalletSignature,
} from '@/lib/personal-watch/guardian-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/guardian/authorize
 * Store standing wallet authorization for Guardian Auto-Exit (premium, non-custodial).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const tier = await resolveSignalTier({ userId: user.id })
  if (tier !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    walletAddress?: string
    mint?: string
    global?: boolean
    maxSlippageBps?: number
    minProceedsRatio?: number
    message?: string
    signatureBase64?: string
  }

  const wallet = body.walletAddress?.trim() ?? ''
  const mint = body.global ? '*' : (body.mint?.trim() ?? '')
  const message = body.message?.trim() ?? ''
  const signatureBase64 = body.signatureBase64?.trim() ?? ''

  if (wallet.length < 32 || !message || !signatureBase64) {
    return NextResponse.json({ error: 'walletAddress, message, signatureBase64 required' }, { status: 400 })
  }
  if (!body.global && mint.length < 32) {
    return NextResponse.json({ error: 'mint or global=true required' }, { status: 400 })
  }

  const maxSlippageBps = Number.isFinite(Number(body.maxSlippageBps))
    ? Math.min(2000, Math.max(10, Number(body.maxSlippageBps)))
    : 150
  const minProceedsRatio = Number.isFinite(Number(body.minProceedsRatio))
    ? Math.min(1, Math.max(0.01, Number(body.minProceedsRatio)))
    : 0.85
  const nonce = randomUUID()
  const expiresAt = guardianAuthExpiresAt()

  const expected = buildGuardianAuthMessage({
    userId: user.id,
    wallet,
    mint: body.global ? '*' : mint,
    maxSlippageBps,
    minProceedsRatio,
    nonce,
    expiresAt,
  })

  if (message !== expected) {
    return NextResponse.json({ error: 'Authorization message mismatch' }, { status: 400 })
  }

  if (!verifyGuardianWalletSignature({ wallet, message, signatureBase64 })) {
    return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 })
  }

  const sb = getSupabaseAdmin()
  const authFields = {
    authorized_wallet: wallet,
    authorized_at: new Date().toISOString(),
    authorization_message: message,
    authorization_sig: signatureBase64,
    max_slippage_bps: maxSlippageBps,
    min_proceeds_ratio: minProceedsRatio,
    updated_at: new Date().toISOString(),
  }

  if (body.global) {
    await sb.from('guardian_auto_exit_settings').upsert(
      { user_id: user.id, ...authFields },
      { onConflict: 'user_id' },
    )
  } else {
    await sb.from('guardian_auto_exit_positions').upsert(
      { user_id: user.id, mint, enabled: false, ...authFields },
      { onConflict: 'user_id,mint' },
    )
  }

  return NextResponse.json({
    ok: true,
    authorizedAt: authFields.authorized_at,
    expiresAt,
    scope: body.global ? 'global' : 'position',
    mint: body.global ? null : mint,
    authMessageTemplate: expected,
  })
}

/** GET — returns message template for client signing. */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const tier = await resolveSignalTier({ userId: user.id })
  if (tier !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  const mint = req.nextUrl.searchParams.get('mint')?.trim()
  const global = req.nextUrl.searchParams.get('global') === 'true'
  const maxSlippageBps = Number(req.nextUrl.searchParams.get('maxSlippageBps') ?? 150)
  const minProceedsRatio = Number(req.nextUrl.searchParams.get('minProceedsRatio') ?? 0.85)

  if (wallet.length < 32) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 })
  }
  if (!global && (!mint || mint.length < 32)) {
    return NextResponse.json({ error: 'mint or global=true required' }, { status: 400 })
  }

  const nonce = randomUUID()
  const expiresAt = guardianAuthExpiresAt()
  const message = buildGuardianAuthMessage({
    userId: user.id,
    wallet,
    mint: global ? '*' : mint!,
    maxSlippageBps,
    minProceedsRatio,
    nonce,
    expiresAt,
  })

  return NextResponse.json({ message, nonce, expiresAt })
}
