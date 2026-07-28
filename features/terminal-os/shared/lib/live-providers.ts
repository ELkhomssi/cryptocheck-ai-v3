/**
 * Client-side live providers — call /api/terminal-os/feed (never hit third parties from browser).
 */

import type {
  IMarketDataProvider,
  ITraderLeaderboardProvider,
  IWhaleFeedProvider,
} from './providers'
import type {
  CandleBar,
  ChainId,
  ChainMarketSnapshot,
  MarketOverview,
  TickerQuote,
  TokenRow,
  TopTrader,
  WhaleMovement,
} from '../types'

async function feed<T>(resource: string, params?: Record<string, string>): Promise<T> {
  const q = new URLSearchParams({ resource, ...params })
  const res = await fetch(`/api/terminal-os/feed?${q.toString()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Terminal OS feed ${resource} failed (${res.status})`)
  return (await res.json()) as T
}

export const liveMarketDataProvider: IMarketDataProvider = {
  async getTickerQuotes() {
    const body = await feed<{ items: TickerQuote[] }>('ticker')
    return body.items ?? []
  },
  async getTopTokens(chain: ChainId) {
    const body = await feed<{ items: TokenRow[] }>('tokens', { chain, limit: '12' })
    return body.items ?? []
  },
  async getChainSnapshots() {
    const body = await feed<{ items: ChainMarketSnapshot[] }>('snapshots')
    return body.items ?? []
  },
  async getCandles(chain: ChainId) {
    const body = await feed<{ items: CandleBar[] }>('candles', { chain })
    return body.items ?? []
  },
  async getMarketOverview() {
    const body = await feed<{ item: MarketOverview | null }>('overview')
    return body.item ?? null
  },
}

export const liveWhaleFeedProvider: IWhaleFeedProvider = {
  async getRecentMovements(limit = 32) {
    const body = await feed<{ items: WhaleMovement[] }>('whales', { limit: String(limit) })
    return body.items ?? []
  },
}

export const liveTraderLeaderboardProvider: ITraderLeaderboardProvider = {
  async getTopTradersToday() {
    const body = await feed<{ items: TopTrader[] }>('traders', { limit: '8' })
    return body.items ?? []
  },
}
