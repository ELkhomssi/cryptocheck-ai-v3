import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { createPaymentIntent, getPaymentIntent } from '@/lib/payments/payment-intent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** POST /api/payments/intent — create a risk-checked payment intent (public; payer not required to be authed). */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const toWallet = typeof raw.toWallet === 'string' ? raw.toWallet.trim() : ''
  const tokenMint = typeof raw.tokenMint === 'string' ? raw.tokenMint.trim() : ''
  const amountUsd = Number(raw.amountUsd)
  const chain = raw.chain === 'ethereum' || raw.chain === 'base' ? raw.chain : 'solana'
  const fromWallet = typeof raw.fromWallet === 'string' ? raw.fromWallet.trim() : ''
  const memo = typeof raw.memo === 'string' ? raw.memo.slice(0, 200) : undefined

  if (!isValidSolanaMint(toWallet)) {
    return NextResponse.json({ error: 'Invalid recipient wallet', code: 'INVALID_RECIPIENT' }, { status: 400, headers: CORS })
  }
  if (!isValidSolanaMint(tokenMint)) {
    return NextResponse.json({ error: 'Invalid token mint', code: 'INVALID_TOKEN' }, { status: 400, headers: CORS })
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' }, { status: 400, headers: CORS })
  }

  try {
    const intent = await createPaymentIntent({ fromWallet, toWallet, tokenMint, amountUsd, chain, memo })
    return NextResponse.json(intent, { status: 200, headers: CORS })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create intent', code: 'INTENT_FAILED' },
      { status: 500, headers: CORS }
    )
  }
}

/** GET /api/payments/intent?id=pi_... — current status + risk assessment. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!id.startsWith('pi_')) {
    return NextResponse.json({ error: 'Invalid intent id', code: 'INVALID_ID' }, { status: 400, headers: CORS })
  }
  const intent = await getPaymentIntent(id)
  if (!intent) {
    return NextResponse.json({ error: 'Intent not found or expired', code: 'NOT_FOUND' }, { status: 404, headers: CORS })
  }
  return NextResponse.json(intent, { status: 200, headers: CORS })
}
