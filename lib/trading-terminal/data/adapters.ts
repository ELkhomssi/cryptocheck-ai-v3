/**
 * Terminal data adapters — DemoAdapter vs LiveAdapter behind one façade.
 * Components import from here; they never branch on seed internals.
 */

import type { MarketStat } from '../market-stats'
import { awaitingStat } from '../market-stats'
import { flatBaseline } from '../mocks/market-sparklines.mock'
import { getDemoSeed } from './demo-seed'
import type {
  DemoCoachBundle,
  DemoPosition,
  DemoSeed,
  DemoTrade,
  DiscoverToken,
  FeedResult,
  IntelEvent,
  TerminalDataMode,
} from './types'

export type TerminalSnapshot = {
  mode: TerminalDataMode
  discover: FeedResult<DiscoverToken[]>
  marketStats: FeedResult<MarketStat[]>
  fearGreed: FeedResult<{ score: number; label: string }>
  intel: FeedResult<IntelEvent[]>
  positions: FeedResult<DemoPosition[]>
  portions: FeedResult<DemoSeed['portions']>
  trades: FeedResult<DemoTrade[]>
  coach: FeedResult<DemoCoachBundle>
  charts: FeedResult<DemoSeed['charts']>
  watchlists: FeedResult<DemoSeed['watchlists']>
  tradeMarks: FeedResult<DemoSeed['tradeMarks']>
  sniper: FeedResult<DemoSeed['sniper']>
  focus: { mint: string; symbol: string } | null
  solPriceUsd: number | null
  /** Live dependency note for ops. */
  liveNote: string | null
}

function demoSnapshot(): TerminalSnapshot {
  const seed = getDemoSeed()
  const marketStats: MarketStat[] = seed.market.stats.map((s) => ({
    id: s.id as MarketStat['id'],
    label: s.label,
    value: s.value,
    changePct: s.changePct,
    tone: s.tone,
    sparkline: s.sparkline,
    awaitingCaption: 'awaiting market feed',
    loading: false,
  }))

  return {
    mode: 'demo',
    discover: { status: 'ready', data: seed.discover },
    marketStats: { status: 'ready', data: marketStats },
    fearGreed: { status: 'ready', data: seed.market.fearGreed },
    intel: { status: 'ready', data: seed.intel },
    positions: { status: 'ready', data: seed.positions },
    portions: { status: 'ready', data: seed.portions },
    trades: { status: 'ready', data: seed.trades },
    coach: { status: 'ready', data: seed.coach },
    charts: { status: 'ready', data: seed.charts },
    watchlists: { status: 'ready', data: seed.watchlists },
    tradeMarks: { status: 'ready', data: seed.tradeMarks },
    sniper: { status: 'ready', data: seed.sniper },
    focus: { mint: seed.focusMint, symbol: seed.focusSymbol },
    solPriceUsd: seed.solPriceUsd,
    liveNote: null,
  }
}

/**
 * Live adapter — returns honest unavailable where feeds aren't wired.
 * SOL/health/discover are filled by callers from real hooks when present.
 */
export function liveBaseSnapshot(partial?: {
  discover?: DiscoverToken[]
  solPriceUsd?: number | null
  healthOk?: boolean
}): TerminalSnapshot {
  const sol =
    partial?.solPriceUsd != null
      ? ({
          id: 'sol_price' as const,
          label: 'SOL PRICE',
          value: `$${partial.solPriceUsd.toFixed(2)}`,
          changePct: null,
          tone: 'neutral' as const,
          sparkline: flatBaseline(),
          awaitingCaption: 'awaiting market feed',
          loading: false,
        } satisfies MarketStat)
      : awaitingStat('sol_price', 'SOL PRICE', flatBaseline())

  const marketStats: MarketStat[] = [
    awaitingStat('market_cap', 'MARKET CAP', flatBaseline()),
    awaitingStat('volume_24h', '24H VOLUME', flatBaseline()),
    awaitingStat('btc_dominance', 'BTC DOMINANCE', flatBaseline()),
    sol,
    awaitingStat('active_wallets', 'ACTIVE WALLETS', flatBaseline()),
  ]

  const discoverRows = partial?.discover ?? []

  return {
    mode: 'live',
    discover:
      discoverRows.length > 0
        ? { status: 'ready', data: discoverRows }
        : { status: 'unavailable', reason: 'Awaiting market feed.' },
    marketStats: { status: 'ready', data: marketStats },
    fearGreed: { status: 'unavailable', reason: 'Fear & Greed feed offline.' },
    intel: { status: 'unavailable', reason: 'On-chain intel stream connecting…' },
    positions: { status: 'unavailable', reason: 'Connect a wallet to load positions.' },
    portions: { status: 'unavailable', reason: 'Connect a wallet to analyze allocation.' },
    trades: { status: 'unavailable', reason: 'No terminal fills yet.' },
    coach: { status: 'unavailable', reason: 'Select a symbol to analyze.' },
    charts: { status: 'unavailable', reason: 'No symbol loaded.' },
    watchlists: { status: 'unavailable', reason: 'No watchlists yet.' },
    tradeMarks: { status: 'unavailable', reason: 'No marked trades yet.' },
    sniper: { status: 'unavailable', reason: 'Disarmed — focus a symbol to arm.' },
    focus: null,
    solPriceUsd: partial?.solPriceUsd ?? null,
    liveNote:
      'Live mode requires deployed ingestion (Helius / scan gateway / portfolio APIs) with env credentials — not localhost.',
  }
}

export function getTerminalSnapshot(
  mode: TerminalDataMode,
  livePartial?: Parameters<typeof liveBaseSnapshot>[0],
): TerminalSnapshot {
  return mode === 'demo' ? demoSnapshot() : liveBaseSnapshot(livePartial)
}
