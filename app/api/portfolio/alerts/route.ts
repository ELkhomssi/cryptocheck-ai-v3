import { NextRequest, NextResponse } from 'next/server'
import { alertsForSymbols, listAlerts } from '@/lib/portfolio-desk/alerts-store'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/alerts?wallet=…
 * Latest alerts for tokens the wallet holds (from Helius webhook store).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  try {
    if (!wallet) {
      return NextResponse.json({ alerts: await listAlerts(20) })
    }
    const holdings = await buildHoldingsResponse(wallet)
    const symbols = new Set(holdings.holdings.map((h) => h.symbol.toUpperCase()))
    return NextResponse.json({
      alerts: await alertsForSymbols(symbols, 20),
      fetchedAt: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ alerts: await listAlerts(20) })
  }
}
