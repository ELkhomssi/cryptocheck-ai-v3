/**
 * Terminal data-mode contracts.
 * Components read adapters only — never hardcode panel numbers in JSX.
 */

export type TerminalDataMode = 'demo' | 'live'

export type FeedStatus = 'ready' | 'loading' | 'unavailable'

export type FeedResult<T> =
  | { status: 'ready'; data: T }
  | { status: 'loading' }
  | { status: 'unavailable'; reason: string }

export type DiscoverBadge = 'HOT' | 'TRENDING' | 'NEW' | 'RISK' | 'SAFE'

export type DiscoverToken = {
  mint: string
  symbol: string
  name: string
  priceUsd: number
  changePct: number
  marketCapUsd: number
  views: number
  badge: DiscoverBadge | null
}

export type IntelEventKind =
  | 'smart_money_buy'
  | 'smart_money_sell'
  | 'new_pool'
  | 'whale_accumulation'
  | 'risk_score_change'
  | 'large_buy'
  | 'large_sell'

export type IntelEvent = {
  id: string
  kind: IntelEventKind
  headline: string
  detail: string
  mint: string | null
  symbol: string | null
  at: string
  /** Live: tx/wallet ref. Demo: synthetic id. */
  ref: string
}

export type DemoPosition = {
  mint: string
  symbol: string
  size: number
  entryUsd: number
  priceUsd: number
  pnlUsd: number
  pnlPct: number
  change24hPct: number
  valueUsd: number
  verdict: 'SAFE' | 'CAUTION' | 'DANGER'
  riskScore: number
}

export type DemoTrade = {
  id: string
  mint: string
  symbol: string
  side: 'buy' | 'sell'
  priceUsd: number
  at: string
  coachTag: 'SAFE' | 'CAUTION' | 'HIGH RISK' | 'TAKE PROFIT'
}

export type DemoChartSlot = {
  mint: string
  symbol: string
  timeframe: string
  lastPrice: number
  changePct: number
  /** Synthetic OHLCV for demo sparkline / future lightweight-charts. */
  candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>
}

export type DemoCoachBundle = {
  mint: string
  symbol: string
  name: string
  verdict: 'SAFE' | 'CAUTION' | 'DANGER' | 'BLOCKED'
  riskScore: number
  safetyScore: number
  confidencePct: number
  evidenceCoveragePct: number
  why: Array<{ text: string; direction: 'up' | 'risk'; sourceField: string }>
  action: string
  tradePlan: {
    entryZone: string
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    invalidation: string
    takeProfits: string[]
    suggestedSize: string
  }
  portfolioHealth: { score: number; issues: string[] }
  riskExposure: { categories: Array<{ name: string; pct: number }>; flags: string[] }
  opportunities: Array<{ symbol: string; reason: string; conviction: number }>
  threats: Array<{ symbol: string; reason: string; severity: 'LOW' | 'MED' | 'HIGH' }>
  smartMoney: { netFlowUsd: number; notable: string[] }
  capitalAllocation: string
  similar: {
    count: number
    avgOutcomePct: number
    winRatePct: number
    avgHoldDays: number
  }
  actionQueue: Array<{
    type: 'EXIT' | 'REDUCE' | 'MONITOR' | 'ADD' | 'WATCHLIST'
    symbol: string
    reason: string
    priority: number
  }>
  weekly: {
    weekOf: string
    topNarrative: string
    smartMoneyRotation: string
    convictionSector: string
    biggestRisk: string
    summary: string
  }
}

export type DemoMarketBundle = {
  stats: Array<{
    id: string
    label: string
    value: string
    changePct: string | null
    tone: 'pos' | 'neg' | 'neutral'
    sparkline: number[]
  }>
  fearGreed: { score: number; label: string }
  health: 'ok' | 'degraded'
}

export type DemoSeed = {
  /** DEMO_SEED — labeled demo dataset; never present as live market state. */
  tag: 'DEMO_SEED'
  seed: number
  focusMint: string
  focusSymbol: string
  market: DemoMarketBundle
  discover: DiscoverToken[]
  charts: DemoChartSlot[]
  coach: DemoCoachBundle
  positions: DemoPosition[]
  portions: {
    totalUsd: number
    pnl24hUsd: number
    pnl24hPct: number
    legend: Array<{ name: string; pct: number; valueUsd: number }>
  }
  trades: DemoTrade[]
  intel: IntelEvent[]
  watchlists: Array<{ id: string; name: string; count: number }>
  tradeMarks: {
    marked: number
    winRatePct: number
    avgDeltaPct: number
    bestPct: number
    worstPct: number
  }
  sniper: {
    armed: boolean
    target: string
    rescanInSec: number
    riskMonitor: 'LOW' | 'MED' | 'HIGH'
    sparkline: number[]
  }
  solPriceUsd: number
}
