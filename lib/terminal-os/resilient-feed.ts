/**
 * Resilient Terminal OS feed wrappers — always return FeedEnvelope.
 */

import 'server-only'

import {
  fetchLiveCandles,
  fetchLiveChainSnapshots,
  fetchLiveMarketOverview,
  fetchLiveTickerQuotes,
  fetchLiveTopTokens,
  fetchLiveTopTraders,
  fetchLiveWhaleMovements,
} from '@/lib/terminal-os/live-market'
import { resilientProvider, type FeedEnvelope } from '@/lib/terminal-os/resilience'
import {
  DEMO_OVERVIEW,
  DEMO_TICKER,
  DEMO_TOKENS,
  DEMO_TRADERS,
  demoWhales,
} from '@/lib/terminal-os/demo-dataset'
import type { ChainId } from '@/features/terminal-os/shared/types'

export async function resilientTicker() {
  return resilientProvider({
    key: 'ticker',
    ttlSec: 12,
    provider: 'coingecko',
    fetchLive: fetchLiveTickerQuotes,
    isEmpty: (v) => !v?.length,
    demoFallback: () => DEMO_TICKER,
  })
}

export async function resilientOverview() {
  return resilientProvider({
    key: 'overview',
    ttlSec: 30,
    provider: 'coingecko',
    fetchLive: async () => {
      const v = await fetchLiveMarketOverview()
      if (!v) throw new Error('no overview')
      return v
    },
    demoFallback: () => ({ ...DEMO_OVERVIEW, fetchedAt: new Date().toISOString() }),
  })
}

export async function resilientTokens(chain: ChainId, limit = 12) {
  return resilientProvider({
    key: `tokens:${chain}:${limit}`,
    ttlSec: 20,
    provider: 'dexscreener',
    fetchLive: () => fetchLiveTopTokens(chain, limit),
    isEmpty: (v) => !v?.length,
    demoFallback: () =>
      DEMO_TOKENS.filter((t) => chain === 'all' || t.chain === chain).slice(0, limit),
  })
}

export async function resilientWhales(limit = 24) {
  return resilientProvider({
    key: `whales:${limit}`,
    ttlSec: 25,
    provider: process.env.WHALE_ALERT_API_KEY ? 'whale-alert' : 'dexscreener-volume',
    fetchLive: () => fetchLiveWhaleMovements(limit),
    isEmpty: (v) => !v?.length,
    demoFallback: demoWhales,
  })
}

export async function resilientTraders(limit = 8) {
  return resilientProvider({
    key: `traders:${limit}`,
    ttlSec: 30,
    provider: 'coingecko-markets',
    fetchLive: () => fetchLiveTopTraders(limit),
    isEmpty: (v) => !v?.length,
    demoFallback: () => DEMO_TRADERS.slice(0, limit),
  })
}

export async function resilientSnapshots() {
  const { mockChainSnapshots } = await import('@/features/terminal-os/shared/lib/mock-data')
  const demo = mockChainSnapshots()
  return resilientProvider({
    key: 'snapshots',
    ttlSec: 60,
    provider: 'coingecko+dexscreener',
    fetchLive: fetchLiveChainSnapshots,
    isEmpty: (v) => !v?.length,
    demoFallback: () => demo,
  })
}

export async function resilientCandles(chain: ChainId) {
  return resilientProvider({
    key: `candles:${chain}`,
    ttlSec: 60,
    provider: 'coingecko-ohlc',
    fetchLive: () => fetchLiveCandles(chain),
    isEmpty: (v) => !v?.length,
    demoFallback: () => {
      const now = Math.floor(Date.now() / 1000)
      let p = 100
      return Array.from({ length: 48 }, (_, i) => {
        p += Math.sin(i / 3) * 2
        return {
          time: now - (48 - i) * 3600,
          open: p,
          high: p + 2,
          low: p - 2,
          close: p + 0.5,
          volume: 1_000_000 + i * 10_000,
        }
      })
    },
  })
}

export async function warmTerminalOsCache(): Promise<{ warmed: string[] }> {
  const warmed: string[] = []
  const jobs: Array<[string, () => Promise<FeedEnvelope<unknown>>]> = [
    ['ticker', () => resilientTicker()],
    ['overview', () => resilientOverview()],
    ['tokens:all', () => resilientTokens('all', 12)],
    ['tokens:solana', () => resilientTokens('solana', 12)],
    ['whales', () => resilientWhales(24)],
    ['traders', () => resilientTraders(8)],
  ]
  await Promise.allSettled(
    jobs.map(async ([name, fn]) => {
      await fn()
      warmed.push(name)
    }),
  )
  return { warmed }
}
