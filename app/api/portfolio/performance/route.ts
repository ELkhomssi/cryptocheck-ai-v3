import { NextRequest, NextResponse } from 'next/server'
import { RANGE_MS } from '@/lib/portfolio-desk/constants'
import { fetchPriceHistory } from '@/lib/portfolio-desk/coingecko'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import type { PerformancePoint, PerformanceResponse } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Range = keyof typeof RANGE_MS

/**
 * Reconstruct wallet USD value over time as:
 *   sum(historicalPrice(token, t) × currentHeldAmount(token))
 * Simplification: uses current holdings if we don't have historical balance snapshots yet.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  const rangeParam = (req.nextUrl.searchParams.get('range') ?? '24H').toUpperCase() as Range
  if (wallet.length < 32) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 })
  }
  if (!(rangeParam in RANGE_MS)) {
    return NextResponse.json({ error: 'invalid range' }, { status: 400 })
  }

  try {
    const holdings = await buildHoldingsResponse(wallet)
    // Cap history fetch to top holdings to respect free-tier limits
    const top = holdings.holdings.slice(0, 8)
    const histories = await Promise.all(
      top.map(async (h) => ({
        mint: h.mint,
        amount: h.amount,
        series: await fetchPriceHistory(h.mint, rangeParam),
      })),
    )

    const withHistory = histories.filter((h) => h.series.length > 0)
    if (!withHistory.length) {
      // Honest empty — no fabricated equity curve
      const empty: PerformanceResponse = {
        walletAddress: wallet,
        range: rangeParam,
        series: [],
        simplification:
          'No CoinGecko/Birdeye history for held mints. Chart stays empty rather than inventing points.',
      }
      return NextResponse.json(empty)
    }

    // Align on union of timestamps (sample ~80 points)
    const allTs = new Set<number>()
    for (const h of withHistory) {
      for (const p of h.series) allTs.add(p.t)
    }
    const sorted = [...allTs].sort((a, b) => a - b)
    const step = Math.max(1, Math.floor(sorted.length / 80))
    const sampled = sorted.filter((_, i) => i % step === 0)

    const series: PerformancePoint[] = sampled.map((t) => {
      let valueUsd = 0
      for (const h of withHistory) {
        const price = nearestPrice(h.series, t)
        if (price != null) valueUsd += price * h.amount
      }
      return { t, valueUsd }
    })

    const body: PerformanceResponse = {
      walletAddress: wallet,
      range: rangeParam,
      series,
      simplification:
        'Assumes current holdings at each historical timestamp (no balance snapshots yet).',
    }
    return NextResponse.json(body)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Performance unavailable'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

function nearestPrice(series: { t: number; price: number }[], t: number): number | null {
  if (!series.length) return null
  let best = series[0]!
  let bestDist = Math.abs(best.t - t)
  for (const p of series) {
    const d = Math.abs(p.t - t)
    if (d < bestDist) {
      best = p
      bestDist = d
    }
  }
  return best.price
}
