/**
 * Client-side live providers — call /api/terminal-os/feed.
 * Provenance (demo/stale/source) survives to UI — never strip.
 */

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

export type LiveFeedMeta = {
  demo: boolean
  stale: boolean
  source: string
  ageSec: number
}

export type LiveFeedResult<T> = {
  items: T[]
  meta: LiveFeedMeta
}

export type LiveFeedItemResult<T> = {
  item: T | null
  meta: LiveFeedMeta
}

export const EMPTY_META: LiveFeedMeta = {
  demo: false,
  stale: false,
  source: 'unknown',
  ageSec: 0,
}

async function feed<T extends Record<string, unknown>>(
  resource: string,
  params?: Record<string, string>,
): Promise<T & LiveFeedMeta> {
  const q = new URLSearchParams({ resource, ...params })
  const res = await fetch(`/api/terminal-os/feed?${q.toString()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Terminal OS feed ${resource} failed (${res.status})`)
  const body = (await res.json()) as T & Partial<LiveFeedMeta>
  return {
    ...body,
    demo: Boolean(body.demo),
    stale: Boolean(body.stale),
    source: typeof body.source === 'string' ? body.source : 'live',
    ageSec: typeof body.ageSec === 'number' ? body.ageSec : 0,
  }
}

function metaOf(body: LiveFeedMeta): LiveFeedMeta {
  return {
    demo: Boolean(body.demo),
    stale: Boolean(body.stale),
    source: body.source || 'live',
    ageSec: body.ageSec ?? 0,
  }
}

export const liveMarketDataProvider = {
  async getTickerQuotes(): Promise<LiveFeedResult<TickerQuote>> {
    const body = await feed<{ items?: TickerQuote[] }>('ticker')
    return { items: body.items ?? [], meta: metaOf(body) }
  },
  async getTopTokens(chain: ChainId): Promise<LiveFeedResult<TokenRow>> {
    const body = await feed<{ items?: TokenRow[] }>('tokens', { chain, limit: '12' })
    return { items: body.items ?? [], meta: metaOf(body) }
  },
  async getChainSnapshots(): Promise<LiveFeedResult<ChainMarketSnapshot>> {
    const body = await feed<{ items?: ChainMarketSnapshot[] }>('snapshots')
    return { items: body.items ?? [], meta: metaOf(body) }
  },
  async getCandles(chain: ChainId): Promise<LiveFeedResult<CandleBar>> {
    const body = await feed<{ items?: CandleBar[] }>('candles', { chain })
    return { items: body.items ?? [], meta: metaOf(body) }
  },
  async getMarketOverview(): Promise<LiveFeedItemResult<MarketOverview>> {
    const body = await feed<{ item?: MarketOverview | null }>('overview')
    return { item: body.item ?? null, meta: metaOf(body) }
  },
}

export const liveWhaleFeedProvider = {
  async getRecentMovements(limit = 32): Promise<LiveFeedResult<WhaleMovement>> {
    const body = await feed<{ items?: WhaleMovement[] }>('whales', { limit: String(limit) })
    return { items: body.items ?? [], meta: metaOf(body) }
  },
}

export const liveTraderLeaderboardProvider = {
  async getTopTradersToday(): Promise<LiveFeedResult<TopTrader>> {
    const body = await feed<{ items?: TopTrader[] }>('traders', { limit: '8' })
    return { items: body.items ?? [], meta: metaOf(body) }
  },
}
