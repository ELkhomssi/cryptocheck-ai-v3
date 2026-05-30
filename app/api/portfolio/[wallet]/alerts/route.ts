import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { resolveScanAuthOnly } from '@/lib/auth/scan-access'
import { monitorPortfolioRisk } from '@/lib/portfolio/risk-monitor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/portfolio/[wallet]/alerts — current portfolio risk alerts (pull model for SSE polling).
 * Auth: session or API key.
 */
export async function GET(req: NextRequest, { params }: { params: { wallet: string } }) {
  const auth = await resolveScanAuthOnly(req)
  if (auth.ok === false) return auth.response

  const wallet = params.wallet?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet', code: 'INVALID_WALLET' }, { status: 400 })
  }
  const chain = req.nextUrl.searchParams.get('chain')?.trim() || 'solana'

  const alerts = await monitorPortfolioRisk(wallet, chain)
  return NextResponse.json({ wallet, chain, alerts }, { status: 200 })
}
