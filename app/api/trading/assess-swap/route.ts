import { NextRequest, NextResponse } from 'next/server'
import { withScanAccess, type ScanAccessContext } from '@/lib/auth/scan-access'
import { assessSwapIntent, type SwapIntent } from '@/lib/trading/risk-gated-swap'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/trading/assess-swap — risk-scores a swap intent (fast mode) before execution.
 * Never executes; returns a SwapDecision. Auth: session or API key (withScanAccess).
 */
export const POST = withScanAccess(async (req: NextRequest, _ctx: ScanAccessContext) => {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const toToken = typeof raw.toToken === 'string' ? raw.toToken.trim() : ''
  if (toToken.length < 32) {
    return NextResponse.json(
      { error: 'toToken (Solana mint) is required', code: 'INVALID_INPUT' },
      { status: 400, headers: gatewayResponseHeaders() }
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
      { status: 500, headers: gatewayResponseHeaders() }
    )
  }
})
