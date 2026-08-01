/**
 * Layer 3 — Canonical Decision schema.
 * The only opinion-shaped object Layer 4 surfaces may read.
 * Zero @/ imports — publishable package.
 */

/** Layer 1 engine ids — facts/signals only; never emit Decision.action */
export type EngineId =
  | 'market-intelligence'
  | 'security-scanner'
  | 'portfolio-intelligence'
  | 'whale-intelligence'
  | 'trader-dna'
  | 'liquidity-engine'
  | 'prediction-engine'
  | 'collective-intelligence'

export type DecisionAction = 'BUY' | 'SELL' | 'WAIT' | 'EXIT' | 'DO_NOTHING'

export type TokenRef = {
  kind: 'token'
  symbol: string
  address?: string
  chain: string
}

export type WalletRef = {
  kind: 'wallet'
  address: string
  chain: string
}

export type DecisionSubject = TokenRef | WalletRef

export type ContributingFactor = {
  engine: EngineId | string
  summary: string
  weight: number
}

/**
 * One opinion. Emitted only by the Decision Engine (Layer 2).
 * Layer 4 consumers are read-only.
 */
export interface Decision {
  id: string
  subject: DecisionSubject
  action: DecisionAction
  /** 0–100 confidence to act */
  confidence: number
  /** Explainable reasoning generated FROM this Decision */
  reasoning: string
  contributingFactors: ContributingFactor[]
  risk: number
  expectedROI?: number
  expectedDrawdown?: number
  /** True if any Layer 1 input was unavailable or sample-degraded */
  degraded: boolean
  degradedInputs?: EngineId[]
  computedAt: string
  /** Consumers refresh after this ISO timestamp */
  staleAfter: string
}

/** Explicit sharding — global engines vs per-wallet engines */
export const ENGINE_SHARDING: Record<
  EngineId,
  'global' | 'per_user'
> = {
  'market-intelligence': 'global',
  'security-scanner': 'global',
  'whale-intelligence': 'global',
  'liquidity-engine': 'global',
  'prediction-engine': 'global',
  'collective-intelligence': 'global',
  'portfolio-intelligence': 'per_user',
  'trader-dna': 'per_user',
}
