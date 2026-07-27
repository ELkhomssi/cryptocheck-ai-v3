/**
 * POST /api/auth/siws/challenge
 * Body optional: { wallet?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildSiwsMessage, issueSiwsChallenge } from '@/lib/identity/siws'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let wallet: string | null = null
  try {
    const body = (await req.json().catch(() => ({}))) as { wallet?: string }
    wallet = body.wallet?.trim() || null
  } catch {
    wallet = null
  }

  try {
    const challenge = await issueSiwsChallenge(wallet)
    const host =
      req.headers.get('x-forwarded-host') ||
      req.headers.get('host') ||
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '') ||
      'cryptocheckai.com'
    const domain = host.split(':')[0]!
    const message = wallet
      ? buildSiwsMessage({
          domain,
          wallet,
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          expiresAt: challenge.expiresAt,
        })
      : null
    return NextResponse.json({
      ...challenge,
      domain,
      message,
    })
  } catch (e) {
    console.error('[siws/challenge]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'challenge failed' },
      { status: 503 },
    )
  }
}
