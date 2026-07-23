import { NextResponse } from 'next/server'
import { TICKER_WATCHLIST } from '@/lib/portfolio-desk/constants'
import { fetchJupiterPrices } from '@/lib/portfolio-desk/jupiter'
import type { TickerQuote } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/portfolio/ticker — Jupiter prices for fixed watchlist (~10s client poll). */
export async function GET() {
  try {
    const prices = await fetchJupiterPrices(TICKER_WATCHLIST.map((t) => t.mint))
    const quotes: TickerQuote[] = TICKER_WATCHLIST.map((t) => {
      const p = prices.get(t.mint)
      return {
        mint: t.mint,
        symbol: t.symbol,
        priceUsd: p?.priceUsd ?? 0,
        change24hPct: p?.change24hPct ?? null,
      }
    }).filter((q) => q.priceUsd > 0)

    return NextResponse.json({ quotes, fetchedAt: new Date().toISOString() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ticker unavailable'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
