import { NextRequest, NextResponse } from 'next/server'
import { assessRiskByMint, gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { fetchWalletHoldings } from '@/lib/helius/fetch-wallet-holdings'
import { mapWithConcurrency } from '@/lib/concurrency/pool'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { aggregateFeesUsd } from '@/lib/revenue-dashboard/fee-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SCAN_HOLDINGS = 12
const SCAN_CONCURRENCY = 6
const FLAG_RISK_FLOOR = 31

/** GET /api/revenue/overview?wallet= — real portfolio + fee aggregates only. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  const [fees, portfolio] = await Promise.all([
    aggregateFeesUsd(),
    wallet && isValidSolanaMint(wallet) ? summarizePortfolio(wallet) : Promise.resolve(null),
  ])

  return NextResponse.json(
    {
      feesEarnedUsd: fees.totalUsd,
      feesSwapCount: fees.swapCount,
      portfolio,
    },
    { status: 200, headers: gatewayResponseHeaders() },
  )
}

async function summarizePortfolio(wallet: string) {
  const holdings = await fetchWalletHoldings(wallet)
  const meaningful = holdings.filter((h) => (h.valueUsd ?? 0) >= 0.5 || h.amount > 0)
  const toScan = meaningful
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))
    .slice(0, MAX_SCAN_HOLDINGS)

  const scanned = await mapWithConcurrency(toScan, SCAN_CONCURRENCY, async (h) => {
    try {
      const risk = await assessRiskByMint(h.mint, 'solana', 'fast')
      return risk.riskScore >= FLAG_RISK_FLOOR
    } catch {
      return false
    }
  })

  const flaggedCount = scanned.filter(Boolean).length

  return {
    holdingCount: meaningful.length,
    flaggedCount,
    scannedCount: toScan.length,
    partial: meaningful.length > toScan.length,
  }
}
