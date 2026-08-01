/**
 * Phase 11 — AI Employees type contracts.
 * Config objects only — all employees share the same backend model.
 * Phase 16 — each employee maps to one or more Intelligence Modules.
 */

import type { IntelligenceModuleId } from '@/types/intelligence'

export type AgentDataSource =
  | 'jupiter-price'
  | 'birdeye-ohlcv'
  | 'birdeye-token'
  | 'birdeye-screener'
  | 'birdeye-new-listings'
  | 'raydium-pools'
  | 'helius-metadata'
  | 'helius-webhooks'
  | 'portfolio-analytics'
  | 'portfolio-alerts'
  | 'news-sentiment'

export type AgentActionType = 'chat' | 'report' | 'signals' | 'analysis' | 'optimize'

export type AgentIconTone = 'gold' | 'green' | 'red' | 'chain' | 'accent'

/** Explicit, computable definition of what an employee's performance % measures. */
export type PerformanceFormulaId =
  | 'setup_win_rate'
  | 'report_completeness'
  | 'outlook_directional_accuracy'
  | 'whale_followthrough'
  | 'portfolio_coverage'
  | 'news_freshness'
  | 'launch_approval_safety'
  | 'suggestion_acceptance'
  | 'scam_detection_accuracy'
  | 'growth_content_impact'

export type PerformanceFormula = {
  id: PerformanceFormulaId
  /** Human-readable description of what the % means. */
  description: string
  /** Minimum resolved samples before a % may be shown (else Calibrating). */
  minSamples: number
  /** Hours after prediction before a verifier may resolve it. */
  verificationWindowHours: number
  /** Cron cadence hint for the recompute job. */
  recomputeCadence: 'hourly' | 'daily'
}

export type AIEmployee = {
  id: string
  name: string
  role: string
  dataSources: AgentDataSource[]
  actionType: AgentActionType
  actionLabel: string
  systemPromptTemplate: string
  performanceFormula: PerformanceFormula
  /** Icon tone from existing terminal badge palette. */
  iconTone: AgentIconTone
  /** Lucide icon name key for the badge. */
  icon: string
  builtin: boolean
  /**
   * Intelligence Modules this worker contributes to (Phase 16).
   * Empty = internal tooling only (never shown on module cards).
   * A worker may list multiple modules (e.g. scam-investigator → security + launch).
   */
  modules: IntelligenceModuleId[]
}

export type AgentActivityKind =
  | 'chat'
  | 'report'
  | 'signals'
  | 'analysis'
  | 'optimize'
  | 'heartbeat'
  | 'custom'

export type AgentActivityRow = {
  id: string
  agentId: string
  agentName: string
  kind: AgentActivityKind
  description: string
  walletAddress: string | null
  userId: string | null
  status: 'running' | 'completed' | 'failed'
  createdAt: string
}

export type AgentPredictionStatus = 'pending' | 'correct' | 'incorrect' | 'expired'

export type AgentPredictionRow = {
  id: string
  agentId: string
  kind: string
  subject: string | null
  payload: Record<string, unknown>
  status: AgentPredictionStatus
  resolveAfter: string
  resolvedAt: string | null
  createdAt: string
}

export type AgentPerformanceSnapshot = {
  id: string
  agentId: string
  score: number | null
  sampleSize: number
  calibrating: boolean
  computedAt: string
  meta: Record<string, unknown> | null
}

export type AgentRunRequest = {
  action: AgentActionType
  message?: string
  walletAddress?: string
  mint?: string
  /** Extra free-text for custom / optimize flows. */
  payload?: Record<string, unknown>
  /** Phase 18 — true when invoked from Automation recipes (Pro-gated). */
  automation?: boolean
  source?: 'automation' | string
}

export type AgentRunStructured = {
  title: string
  summary: string
  sections?: Array<{ heading: string; body: string }>
  signals?: Array<{ symbol?: string; mint?: string; note: string; severity?: string }>
  stats?: Array<{ label: string; value: string }>
  suggestions?: Array<{ id: string; title: string; detail: string }>
  disclaimer: string
}

/** Client-safe roster row (system prompt stripped). */
export type RosterEmployeeView = Omit<AIEmployee, 'systemPromptTemplate'> & {
  systemPromptTemplate: string
  performance: {
    score: number | null
    sampleSize: number
    calibrating: boolean
    computedAt: string | null
  }
  currentActivity: string
}

export type TeamOverviewStats = {
  totalEmployees: number
  activeNow: number
  tasksRunning: number
  alertsToday: number
  successRate: number | null
}
