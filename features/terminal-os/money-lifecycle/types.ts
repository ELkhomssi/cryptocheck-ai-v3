/**
 * Money Lifecycle V2 — narrative stage contracts.
 * Stages map to existing engines; no new scoring math lives here.
 */

import type { ExecutionState } from '@/features/execution-desk/types'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import type {
  ExplainableDecision,
  MarketContext,
  PerformanceReport,
  TraderDna,
} from '@/features/terminal-os/ai-trade-like-me/types'

export type LifecycleStageId =
  | 'enters'
  | 'capital'
  | 'you'
  | 'market'
  | 'decides'
  | 'executes'
  | 'grows'
  | 'exits'

/** Ribbon node honesty states — never invent numbers when insufficient. */
export type LifecycleNodeStatus =
  | 'idle'
  | 'ready'
  | 'active'
  | 'insufficient_data'
  | 'needs_config'
  | 'needs_wallet'

export type LifecycleGroupId = 'enters' | 'ai' | 'grows' | 'exits'

export interface LifecycleStageMeta {
  id: LifecycleStageId
  index: number
  shortLabel: string
  fullLabel: string
  group: LifecycleGroupId
  engine: string
}

export const LIFECYCLE_STAGES: LifecycleStageMeta[] = [
  {
    id: 'enters',
    index: 1,
    shortLabel: 'Enters',
    fullLabel: 'Money Enters',
    group: 'enters',
    engine: 'Wallet Connect + licensed on-ramp',
  },
  {
    id: 'capital',
    index: 2,
    shortLabel: 'Capital',
    fullLabel: 'System Understands Your Capital',
    group: 'ai',
    engine: 'Portfolio Intelligence',
  },
  {
    id: 'you',
    index: 3,
    shortLabel: 'You',
    fullLabel: 'AI Understands You',
    group: 'ai',
    engine: 'Behavioral Learning + Trader DNA',
  },
  {
    id: 'market',
    index: 4,
    shortLabel: 'Market',
    fullLabel: 'AI Understands the Market',
    group: 'ai',
    engine: 'MarketContext (Decision Engine input)',
  },
  {
    id: 'decides',
    index: 5,
    shortLabel: 'Decides',
    fullLabel: 'AI Decides',
    group: 'ai',
    engine: 'Decision Engine + Explainable AI',
  },
  {
    id: 'executes',
    index: 6,
    shortLabel: 'Executes',
    fullLabel: 'AI Executes',
    group: 'ai',
    engine: 'Execution Desk Secure Execution',
  },
  {
    id: 'grows',
    index: 7,
    shortLabel: 'Grows',
    fullLabel: 'Money Grows',
    group: 'grows',
    engine: 'Performance Analytics / Portfolio Growth',
  },
  {
    id: 'exits',
    index: 8,
    shortLabel: 'Exits',
    fullLabel: 'Money Exits',
    group: 'exits',
    engine: 'Licensed off-ramp (non-custodial)',
  },
]

export const LIFECYCLE_GROUPS: {
  id: LifecycleGroupId
  label: string
  stageIds: LifecycleStageId[]
}[] = [
  { id: 'enters', label: 'Enters', stageIds: ['enters'] },
  {
    id: 'ai',
    label: 'AI Decides',
    stageIds: ['capital', 'you', 'market', 'decides', 'executes'],
  },
  { id: 'grows', label: 'Grows', stageIds: ['grows'] },
  { id: 'exits', label: 'Exits', stageIds: ['exits'] },
]

export interface RampProviderConfig {
  provider: 'moonpay' | 'transak' | 'ramp' | null
  buyUrl: string | null
  sellUrl: string | null
  configured: boolean
}

export interface LifecycleSnapshot {
  walletConnected: boolean
  walletAddress: string | null
  /** Real connected-wallet balance — never a CryptoCheck-held figure */
  cashReadyUsd: number | null
  availableSol: number | null
  portfolio: PortfolioHealthSummary | null
  portfolioLoading: boolean
  dna: TraderDna | null
  marketContext: MarketContext | null
  decision: ExplainableDecision | null
  executionState: ExecutionState
  performance: PerformanceReport | null
  ramp: RampProviderConfig
}

export interface LifecycleNodeView {
  meta: LifecycleStageMeta
  status: LifecycleNodeStatus
  headline: string
  detailLines: string[]
  ctaLabel?: string
  ctaHref?: string
  /** External licensed provider URL when applicable */
  ctaExternalUrl?: string
}

export interface LifecycleDerived {
  nodes: LifecycleNodeView[]
  activeStageId: LifecycleStageId
  activeGroupId: LifecycleGroupId
}
