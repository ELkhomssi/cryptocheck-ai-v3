/**
 * Execution Desk contracts — presentation + lifecycle only.
 * Engines remain the source of truth (scan gateway, Jupiter, OMS, portfolio).
 */

export type ExecutionSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit'

export interface TokenRef {
  mint: string
  symbol: string
  chain: 'solana'
}

/** Full builder state — every derived field has an explicit formula in builder-math.ts */
export interface ExecutionBuilderState {
  wallet: string
  token: TokenRef
  side: ExecutionSide
  orderType: OrderType
  amountUsd: number
  /** User-adjustable; defaulted from liquidity depth */
  slippageToleranceBps: number
  /** Live estimate from RPC / quote path */
  gasEstimateUsd: number
  priorityFeeUsd: number
  /** Entry reference price (USD) */
  currentPrice: number
  stopLoss: number | null
  takeProfit: number | null

  // derived — never hand-entered
  positionSizeUnits: number
  riskPct: number | null
  riskRewardRatio: number | null
  expectedProfitUsd: number | null
  expectedLossUsd: number | null
  totalEstimatedCostUsd: number
}

/**
 * Transaction lifecycle — every state has a distinct UI.
 * Never collapse these into a generic "processing" spinner.
 */
export type ExecutionState =
  | 'building'
  | 'simulating'
  | 'simulation_failed'
  | 'awaiting_signature'
  | 'broadcasting'
  | 'pending_confirmation'
  | 'confirmed'
  | 'failed'
  | 'reverted'

export interface MevProtectionView {
  /** 0–100, derived from pool depth vs order size + congestion */
  riskScore: number
  /** Solana: jito_private · EVM: flashbots_protect · shared fallbacks */
  route: 'jito_private' | 'flashbots_protect' | 'priority_fee' | 'public_rpc'
  tipLamports: number
  congestion: 'low' | 'medium' | 'high' | 'extreme'
  explanation: string
}

export interface ExecutionAuditPayload {
  builder: ExecutionBuilderState
  securityVerdict: string
  securityRiskScore: number
  decisionSnapshot?: {
    action?: string
    confidence?: number
    reasons?: string[]
    sourceEngineRef?: string
  }
  signature?: string
  executionState: ExecutionState
  at: string
}

/** Absolute USD threshold for extra confirmation friction */
export const LARGE_TRADE_USD_THRESHOLD = 1_000

export const OVERRIDE_PHRASE = 'I understand this token is high risk'
export const LARGE_TRADE_PHRASE = 'CONFIRM LARGE TRADE'
