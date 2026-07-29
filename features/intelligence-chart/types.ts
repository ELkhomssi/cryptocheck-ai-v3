/**
 * Phase 22 — CryptoCheckAI Intelligence Chart contracts.
 * Every overlay layer uses this shape so composition can treat them uniformly.
 * sourceEngine / sourceEngineRef are required — no decorative placeholders.
 */

export type LayerId =
  | 'price'
  | 'liquidity'
  | 'holders'
  | 'developer'
  | 'ai'
  | 'security'
  | 'narrative'

export type EngineId =
  | 'market-intelligence'
  | 'wallet-intelligence'
  | 'security-scanner'
  | 'decision-engine'
  | 'explainable-ai'
  | 'token-scanner'
  | 'aggregation'

export type ChartEventSeverity = 'info' | 'notable' | 'critical'

export type LayerStatus = 'live' | 'no_data' | 'loading'

export interface ChartEvent {
  id: string
  /** Unix seconds — aligns with CandleBar.time */
  timestamp: number
  price: number
  severity: ChartEventSeverity
  label: string
  detail: string
  /** Trace back to the exact engine event / assessment id */
  sourceEngineRef: string
  layerId: LayerId
  /** Optional USD magnitude for sizing markers */
  magnitudeUsd?: number
}

export interface ChartLayer<TEvent extends ChartEvent = ChartEvent> {
  id: LayerId
  sourceEngine: EngineId
  events: TEvent[]
  status: LayerStatus
  /** User-toggled; price layer ignores this (always on) */
  visible: boolean
}

/** AI shaded price band (Layer 5) — not a marker */
export interface AiZoneBand {
  id: string
  kind: 'buy' | 'sell'
  priceLow: number
  priceHigh: number
  timeFrom: number
  timeTo: number
  confidence: number
  sourceEngineRef: string
  label: string
}

/** Compact multi-line strip under price (confidence / conviction / risk / trend) */
export interface AiStripPoint {
  time: number
  confidence: number
  conviction: number
  risk: number
  trend: number
  sourceEngineRef: string
}

export interface LiquidityRibbonPoint {
  time: number
  liquidityUsd: number
  sourceEngineRef: string
}

export interface HolderSeriesPoint {
  time: number
  holderCount: number
  sourceEngineRef: string
}

/** Sidebar / scrubber state at a timestamp */
export interface IntelligenceSidebarState {
  timestamp: number
  aiConviction: number | null
  risk: number | null
  confidence: number | null
  narrative: string | null
  trend: number | null
  smartMoneyActivity: number | null
  whalePressure: 'accumulating' | 'distributing' | 'neutral' | null
  holderHealth: number | null
  sourceRefs: string[]
}

export interface IntelligenceChartBundle {
  token: {
    id: string
    symbol: string
    name: string
    chain: string
    priceUsd: number
    change24hPct: number
    liquidityUsd: number
    volume24hUsd: number
    logoUrl?: string
  }
  candles: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    volume?: number
  }>
  layers: ChartLayer[]
  aiZones: AiZoneBand[]
  aiStrip: AiStripPoint[]
  liquidityRibbon: LiquidityRibbonPoint[]
  holderSeries: HolderSeriesPoint[]
  /** Full timeline of states for Replay scrubber (sparse → interpolated client-side) */
  sidebarTimeline: IntelligenceSidebarState[]
  fetchedAt: string
  stale?: boolean
  demo?: boolean
  source: string
}

export type ChartTool = 'crosshair' | 'measure' | 'replay' | 'compare' | 'screenshot'

/** Default: Price always on; AI on; others off until user builds density */
export const DEFAULT_LAYER_VISIBILITY: Record<Exclude<LayerId, 'price'>, boolean> = {
  liquidity: false,
  holders: false,
  developer: false,
  ai: true,
  security: false,
  narrative: false,
}

export const LAYER_META: Record<
  Exclude<LayerId, 'price'>,
  { label: string; sourceEngine: EngineId; defaultOn: boolean }
> = {
  liquidity: { label: 'Liquidity', sourceEngine: 'market-intelligence', defaultOn: false },
  holders: { label: 'Holders', sourceEngine: 'wallet-intelligence', defaultOn: false },
  developer: { label: 'Developer', sourceEngine: 'security-scanner', defaultOn: false },
  ai: { label: 'AI', sourceEngine: 'decision-engine', defaultOn: true },
  security: { label: 'Security', sourceEngine: 'security-scanner', defaultOn: false },
  narrative: { label: 'Narrative', sourceEngine: 'aggregation', defaultOn: false },
}
