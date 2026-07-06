import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { getPortfolio } from '@/lib/portfolio/portfolio-tracker'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { mapTrackerPortfolio } from '@/lib/revenue-dashboard/portfolio-mapper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/revenue/portfolio?wallet= — gateway-scanned holdings for Revenue Dashboard. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json(
      { error: 'Valid wallet address required', code: 'INVALID_WALLET' },
      { status: 400, headers: gatewayResponseHeaders() },
    )
  }

  try {
    const portfolio = await getPortfolio(wallet, 'solana')
    return NextResponse.json(mapTrackerPortfolio(portfolio), {
      status: 200,
      headers: gatewayResponseHeaders(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Portfolio scan failed'
    return NextResponse.json(
      { error: message, code: 'PORTFOLIO_FAILED' },
      { status: 500, headers: gatewayResponseHeaders() },
    )
  }
}
