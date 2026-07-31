import { NextRequest, NextResponse } from 'next/server'
import { evaluateAlertsForWallet } from '@/lib/terminal-os/alert-engine'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/terminal-os/alerts/evaluate
 * Body: { wallet, prices?, whaleScore?, riskScore?, aiConfidence? }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string
    prices?: Record<string, number>
    whaleScore?: number
    riskScore?: number
    aiConfidence?: number
  }
  const wallet = body.wallet?.trim() ?? ''
  if (!wallet || (!isValidSolanaMint(wallet) && !/^0x[a-fA-F0-9]{40}$/.test(wallet))) {
    return NextResponse.json({ error: 'Valid wallet required' }, { status: 400 })
  }

  const result = await evaluateAlertsForWallet(wallet, {
    prices: body.prices,
    whaleScore: body.whaleScore,
    riskScore: body.riskScore,
    aiConfidence: body.aiConfidence,
  })

  return NextResponse.json(
    { ok: true, fired: result.fired, activeRules: result.activeRules },
    { headers: { 'cache-control': 'no-store' } },
  )
}
