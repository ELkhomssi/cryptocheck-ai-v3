import { NextRequest, NextResponse } from 'next/server'
import {
  fetchLiveCandles,
  fetchLiveChainSnapshots,
  fetchLiveMarketOverview,
  fetchLiveTickerQuotes,
  fetchLiveTopTokens,
  fetchLiveTopTraders,
  fetchLiveWhaleMovements,
} from '@/lib/terminal-os/live-market'
import type { ChainId } from '@/features/terminal-os/shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHAINS = new Set<ChainId>(['solana', 'bnb', 'ethereum', 'base', 'arbitrum', 'all'])

function chainParam(req: NextRequest): ChainId {
  const raw = (req.nextUrl.searchParams.get('chain') || 'all').toLowerCase() as ChainId
  return CHAINS.has(raw) ? raw : 'all'
}

/** GET /api/terminal-os/feed?resource=ticker|tokens|whales|traders|snapshots|candles|overview */
export async function GET(req: NextRequest) {
  const resource = (req.nextUrl.searchParams.get('resource') || 'ticker').toLowerCase()
  const chain = chainParam(req)
  const limit = Math.min(48, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 24) || 24))

  try {
    switch (resource) {
      case 'ticker':
        return NextResponse.json({ items: await fetchLiveTickerQuotes(), source: 'coingecko' })
      case 'overview':
        return NextResponse.json({ item: await fetchLiveMarketOverview(), source: 'coingecko' })
      case 'tokens':
        return NextResponse.json({
          items: await fetchLiveTopTokens(chain, limit),
          chain,
          source: 'dexscreener',
        })
      case 'whales':
        return NextResponse.json({
          items: await fetchLiveWhaleMovements(limit),
          source: process.env.WHALE_ALERT_API_KEY ? 'whale-alert' : 'dexscreener-volume',
        })
      case 'traders':
        return NextResponse.json({
          items: await fetchLiveTopTraders(limit),
          source: 'coingecko-markets',
        })
      case 'snapshots':
        return NextResponse.json({
          items: await fetchLiveChainSnapshots(),
          source: 'coingecko+dexscreener',
        })
      case 'candles':
        return NextResponse.json({
          items: await fetchLiveCandles(chain),
          chain,
          source: 'coingecko-ohlc',
        })
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Feed error'
    return NextResponse.json({ error: message, items: [] }, { status: 502 })
  }
}
