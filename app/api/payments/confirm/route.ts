import { NextRequest, NextResponse } from 'next/server'
import { confirmPaymentIntent } from '@/lib/payments/payment-intent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** POST /api/payments/confirm — submit a signed transaction for an approved intent. */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const intentId = typeof raw.intentId === 'string' ? raw.intentId.trim() : ''
  const signedTransaction = typeof raw.signedTransaction === 'string' ? raw.signedTransaction : ''

  if (!intentId.startsWith('pi_') || !signedTransaction) {
    return NextResponse.json(
      { error: 'intentId and signedTransaction are required', code: 'INVALID_INPUT' },
      { status: 400, headers: CORS }
    )
  }

  try {
    const result = await confirmPaymentIntent(intentId, signedTransaction)
    return NextResponse.json(result, { status: 200, headers: CORS })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Confirmation failed', code: 'CONFIRM_FAILED' },
      { status: 400, headers: CORS }
    )
  }
}
