/**
 * CryptoCheck AI — Solana Execution Engine (contracts)
 *
 * Institutional OMS layer ABOVE existing non-custodial paths:
 *   assessRiskByMint (scan-gateway) → risk-gated-swap → jupiter-client → wallet sign
 *
 * NEVER imports frozen scanner core. NEVER holds private keys.
 * packages/* must not import these (@/ boundary).
 */

/** Where the opportunity entered the OMS. */
export type OpportunitySource =
  | 'launchlab'
  | 'smart_alpha'
  | 'sniper'
  | 'manual'
  | 'api'
  | 'guardian_exit'

export type ExecutionStrategyMode =
  | 'aggressive'
  | 'balanced'
  | 'conservative'
  | 'post_dump_entry'
  | 'liquidity_confirmation'
  | 'smart_entry'

export type RiskCategory = 'low' | 'medium' | 'high' | 'critical'

export type ExecutionPhase =
  | 'intake'
  | 'risk_validation'
  | 'capital_check'
  | 'simulation'
  | 'safety_score'
  | 'strategy_wait'
  | 'build'
  | 'submit'
  | 'confirm'
  | 'reconcile'
  | 'terminal'

export type ExecutionTerminalStatus =
  | 'filled'
  | 'rejected_risk'
  | 'rejected_capital'
  | 'rejected_simulation'
  | 'rejected_safety'
  | 'rejected_critical'
  | 'expired'
  | 'failed_submit'
  | 'failed_confirm'
  | 'cancelled'
  | 'partial'

export type OpportunityIntake = {
  opportunityId: string
  source: OpportunitySource
  userId: string
  walletAddress: string
  mint: string
  symbol?: string
  chain: 'solana'
  side: 'buy' | 'sell'
  /** Notional in SOL (buys) or token base amount (sells) — exact units resolved at build. */
  amountSol?: number
  amountTokenBase?: string
  strategy: ExecutionStrategyMode
  maxSlippageBps: number
  /** Client / API correlation. */
  clientRequestId?: string
  createdAt: string
}

export type RiskValidationReport = {
  opportunityId: string
  riskScore: number
  category: RiskCategory
  verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED' | 'DANGER'
  mintAuthorityActive: boolean
  freezeAuthorityActive: boolean
  liquidityUsd: number | null
  holderConcentrationPct: number | null
  tokenAgeSec: number | null
  transferRestricted: boolean | null
  metadataOk: boolean
  reasons: string[]
  warnings: string[]
  scannedAt: string
  /** Always from scan-gateway — never frozen engine. */
  gatewayPath: 'assessRiskByMint'
}

export type SimulationReport = {
  opportunityId: string
  ok: boolean
  confidence: number
  /** 0..1 — below threshold blocks execution. */
  expectedOutAmountBase: string | null
  minOutAmountBase: string | null
  priceImpactPct: number | null
  unitsConsumed: number | null
  rpcErr: string | null
  honeypotSuspect: boolean
  simulatedAt: string
}

export type ExecutionSafetyScore = {
  opportunityId: string
  score: number
  /** 0..100 — higher = safer */
  passed: boolean
  liquidityHealth: number
  poolQuality: number
  authorityRisk: number
  concentrationRisk: number
  scamIndicators: string[]
  thresholdRequired: number
}

export type CapitalPolicy = {
  maxSolPerTrade: number
  maxExposurePerTokenSol: number
  maxExposurePerWalletSol: number
  maxDailyLossSol: number
  maxDrawdownPct: number
  maxSimultaneousPositions: number
  maxSlippageBps: number
  /** Critical category is never executable regardless of overrides. */
  blockCritical: true
}

export type CapitalCheckResult = {
  ok: boolean
  policy: CapitalPolicy
  reasons: string[]
  currentExposureTokenSol: number
  currentExposureWalletSol: number
  dailyPnlSol: number
  openPositions: number
}

export type JitoBundlePlan = {
  enabled: boolean
  tipLamports: number
  priorityFeeLamports: number
  /** Congestion-aware tip multiplier applied. */
  tipMultiplier: number
  maxRetries: number
  fallback: 'jupiter_priority' | 'rpc_send' | 'abort'
}

export type ExecutionSubmitResult = {
  mode: 'jito_bundle' | 'jupiter_rpc' | 'unsigned_handoff'
  /** Non-custodial: usually unsigned base64 for wallet sign. */
  unsignedTxBase64?: string
  bundleId?: string
  signature?: string
  submittedAt: string
}

export type ExecutionAuditRecord = {
  id: string
  opportunityId: string
  userId: string
  walletAddress: string
  mint: string
  source: OpportunitySource
  strategy: ExecutionStrategyMode
  phase: ExecutionPhase
  status: ExecutionTerminalStatus | 'in_progress'
  risk: RiskValidationReport | null
  simulation: SimulationReport | null
  safety: ExecutionSafetyScore | null
  capital: CapitalCheckResult | null
  jito: JitoBundlePlan | null
  submit: ExecutionSubmitResult | null
  signature: string | null
  realizedPnlSol: number | null
  latencyMs: {
    intakeToRisk?: number
    riskToSim?: number
    simToSubmit?: number
    submitToConfirm?: number
    total?: number
  }
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

/** Strategy knobs — all overridable per user / desk config. */
export type StrategyConfig = {
  mode: ExecutionStrategyMode
  minLiquidityUsd: number
  minTokenAgeSec: number
  maxPriceImpactPct: number
  minSimulationConfidence: number
  minSafetyScore: number
  /** Post-dump: wait N ms after first CA sighting. */
  stabilizeWaitMs: number
  /** Liquidity confirmation: require liquidityUsd >= min for N consecutive polls. */
  liquidityConfirmPolls: number
  /** Smart entry: require neuralScore / structure gate. */
  minNeuralScore: number
}

export const DEFAULT_CAPITAL_POLICY: CapitalPolicy = {
  maxSolPerTrade: 1,
  maxExposurePerTokenSol: 2,
  maxExposurePerWalletSol: 10,
  maxDailyLossSol: 5,
  maxDrawdownPct: 15,
  maxSimultaneousPositions: 5,
  maxSlippageBps: 100,
  blockCritical: true,
}

export const DEFAULT_STRATEGY_CONFIGS: Record<ExecutionStrategyMode, StrategyConfig> = {
  aggressive: {
    mode: 'aggressive',
    minLiquidityUsd: 2_000,
    minTokenAgeSec: 0,
    maxPriceImpactPct: 3,
    minSimulationConfidence: 0.7,
    minSafetyScore: 55,
    stabilizeWaitMs: 0,
    liquidityConfirmPolls: 1,
    minNeuralScore: 60,
  },
  balanced: {
    mode: 'balanced',
    minLiquidityUsd: 8_000,
    minTokenAgeSec: 60,
    maxPriceImpactPct: 1.5,
    minSimulationConfidence: 0.85,
    minSafetyScore: 70,
    stabilizeWaitMs: 0,
    liquidityConfirmPolls: 2,
    minNeuralScore: 70,
  },
  conservative: {
    mode: 'conservative',
    minLiquidityUsd: 25_000,
    minTokenAgeSec: 300,
    maxPriceImpactPct: 0.8,
    minSimulationConfidence: 0.92,
    minSafetyScore: 85,
    stabilizeWaitMs: 0,
    liquidityConfirmPolls: 3,
    minNeuralScore: 80,
  },
  post_dump_entry: {
    mode: 'post_dump_entry',
    minLiquidityUsd: 10_000,
    minTokenAgeSec: 120,
    maxPriceImpactPct: 1.2,
    minSimulationConfidence: 0.88,
    minSafetyScore: 75,
    stabilizeWaitMs: 45_000,
    liquidityConfirmPolls: 2,
    minNeuralScore: 72,
  },
  liquidity_confirmation: {
    mode: 'liquidity_confirmation',
    minLiquidityUsd: 15_000,
    minTokenAgeSec: 30,
    maxPriceImpactPct: 1.0,
    minSimulationConfidence: 0.9,
    minSafetyScore: 80,
    stabilizeWaitMs: 0,
    liquidityConfirmPolls: 4,
    minNeuralScore: 75,
  },
  smart_entry: {
    mode: 'smart_entry',
    minLiquidityUsd: 12_000,
    minTokenAgeSec: 90,
    maxPriceImpactPct: 1.0,
    minSimulationConfidence: 0.9,
    minSafetyScore: 78,
    stabilizeWaitMs: 15_000,
    liquidityConfirmPolls: 3,
    minNeuralScore: 78,
  },
}

export function riskCategoryFromScore(riskScore: number): RiskCategory {
  if (riskScore >= 80) return 'critical'
  if (riskScore >= 60) return 'high'
  if (riskScore >= 35) return 'medium'
  return 'low'
}
