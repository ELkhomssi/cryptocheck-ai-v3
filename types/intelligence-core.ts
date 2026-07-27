/**
 * Phase 17 — Intelligence Core type contracts.
 * Orchestration only — no duplicate warehouse of portfolio/agent data.
 */

export type TimelineSourceTable =
  | 'agent_activity'
  | 'portfolio_alerts'
  | 'terminal_orders'

export type TimelineEvent = {
  id: string
  sourceTable: TimelineSourceTable | string
  sourceId: string
  eventType: string
  summary: string
  module: string | null
  createdAt: string
  /** Phase 18 — wallet or identity user_id when known. */
  ownerKey?: string | null
}

export type UserMemoryActionType =
  | 'token_scanned'
  | 'token_ignored'
  | 'token_favorited'
  | 'wallet_tracked'
  | 'conversation_reference'
  | 'recommendation_shown'
  | 'alert_acknowledged'

export type UserMemoryRow = {
  id: string
  userId: string
  actionType: UserMemoryActionType
  subjectType: string
  subjectId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export type ReportType = 'morning_brief' | 'daily' | 'weekly' | 'monthly'

export type ReportRow = {
  id: string
  reportType: ReportType
  userId: string | null
  walletAddress: string | null
  title: string
  body: string
  insufficientActivity: boolean
  windowStart: string
  windowEnd: string
  eventCount: number
  createdAt: string
}

/** Explicit before/after of REAL underlying metrics — never score-only. */
export type MetricDiffPoint = {
  mintAuthorityActive: boolean | null
  freezeAuthorityActive: boolean | null
  holderConcentrationPct: number | null
  liquidityUsd: number | null
  riskScore: number | null
}

export type RecommendationGrounding = {
  metric: string
  before: MetricDiffPoint | null
  after: MetricDiffPoint | null
  /** Composite scores are optional context — never sufficient alone for a causal claim. */
  scoreBefore: number | null
  scoreAfter: number | null
}

export type RecommendationResult = {
  title: string
  explanation: string
  grounded: boolean
  /** When grounded=false, explanation is the honest fallback string. */
  predictionId: string | null
}

export type TradingContext = {
  walletAddress: string | null
  portfolioSummary: {
    totalValueUsd: number | null
    holdingCount: number
    topSymbol: string | null
  }
  riskExposure: {
    topAllocationPct: number | null
    note: string
  }
  watchlist: Array<{ mint: string; symbol: string | null }>
  recentScans: Array<{ id: string; summary: string; at: string }>
  fetchedAt: string
}

export type CoachContext = {
  walletAddress: string | null
  portfolioBlock: string
  memoryEntries: UserMemoryRow[]
  recentAlerts: Array<{ type: string; title: string; description: string; at: string }>
  timelineSlice: TimelineEvent[]
  fetchedAt: string
}

export type MissionViewModel = {
  market: {
    available: boolean
    aggregateChange24hPct: number | null
    topMoverSymbol: string | null
    topMoverChange24hPct: number | null
    spark: number[]
  }
  portfolio: {
    connected: boolean
    totalValueUsd: number | null
    dayChangePct: number | null
    topWeightSymbol: string | null
    error: string | null
  }
  running: Array<{ id: string; description: string; kind: string }>
  recommendations: RecommendationResult[]
  dailyBrief: {
    title: string
    body: string
    insufficientActivity: boolean
    pending: boolean
    reportId: string | null
  }
  /** Phase 18 — brand-new identity with zero history (not a quiet day). */
  firstRun: boolean
  /** Phase 18 — stable SIWS user id when authenticated. */
  userId: string | null
  fetchedAt: string
}

/** Minimum timeline_events in window before a report may be generated. */
export const REPORT_MIN_EVENTS: Record<ReportType, number> = {
  morning_brief: 3,
  daily: 5,
  weekly: 15,
  monthly: 40,
}

export const NO_DIFF_EXPLANATION = 'Risk changed — detailed cause not yet available'
