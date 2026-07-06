import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { assessSwapIntent, type SwapIntent } from '@/lib/trading/risk-gated-swap'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/revenue/assess-swap — risk gate for Revenue Terminal (gateway fast mode). */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const toToken = typeof raw.toToken === 'string' ? raw.toToken.trim() : ''
  if (!isValidSolanaMint(toToken)) {
    return NextResponse.json(
      { error: 'toToken required', code: 'INVALID_INPUT' },
      { status: 400, headers: gatewayResponseHeaders() },
    )
  }

  const intent: SwapIntent = {
    walletAddress: typeof raw.walletAddress === 'string' ? raw.walletAddress.trim() : '',
    fromToken: typeof raw.fromToken === 'string' ? raw.fromToken.trim() : '',
    toToken,
    amountUsd: Number.isFinite(Number(raw.amountUsd)) ? Math.max(0, Number(raw.amountUsd)) : 0,
    slippageBps: Number.isFinite(Number(raw.slippageBps)) ? Number(raw.slippageBps) : 50,
    chain: 'solana',
  }

  try {
    const decision = await assessSwapIntent(intent)
    return NextResponse.json(decision, { status: 200, headers: gatewayResponseHeaders() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Assessment failed'
    return NextResponse.json(
      { error: message, code: 'ASSESS_FAILED' },
      { status: 500, headers: gatewayResponseHeaders() },
    )
  }
}
