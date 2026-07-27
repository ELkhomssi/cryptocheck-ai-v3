/** Shared contracts for the CryptoCheck Portfolio desk (playbook). */

/**
 * Theme ids map to `html[data-theme]`.
 * - dark / light → Phase 19 signal-blue (canonical)
 * - brass / brass-light → legacy gold (kept for visual rollback until cleanup)
 */
export type PortfolioTheme = 'dark' | 'light' | 'brass' | 'brass-light'

export type Holding = {
  mint: string
  symbol: string
  name: string
  logoUrl: string | null
  amount: number
  valueUsd: number
  priceUsd: number
  change24hPct: number | null
  /** Requires tx history — Step 7+; null until then. */
  avgBuyPriceUsd: number | null
  allocationPct: number
  decimals: number
}

export type HoldingsResponse = {
  walletAddress: string
  totalValueUsd: number
  holdings: Holding[]
  availableSol: number
  availableSolUsd: number
  fetchedAt: string
}

export type TickerQuote = {
  mint: string
  symbol: string
  priceUsd: number
  change24hPct: number | null
}

export type PerformancePoint = {
  t: number
  valueUsd: number
}

export type PerformanceResponse = {
  walletAddress: string
  range: '24H' | '7D' | '30D' | '90D' | 'ALL'
  series: PerformancePoint[]
  /** Current holdings × historical prices (no balance snapshots yet). */
  simplification: string
}

export type PortfolioAlertType =
  | 'whale'
  | 'liquidity'
  | 'dev_wallet'
  | 'smart_money'
  | 'risk'
  | 'whale_buy'
  | 'whale_sell'
  | 'liquidity_added'
  | 'liquidity_removed'
  | 'mint_authority'
  | 'freeze_authority'
  | 'rug_risk'
  | 'smart_money_entry'
  | 'smart_money_exit'
  | 'new_listing'
  | 'large_holder_distribution'
  | 'new_token_launch'

export type PortfolioAlert = {
  id: string
  type: PortfolioAlertType
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  tokenSymbol: string | null
  mint: string | null
  createdAt: string
}

export type AlertPreference = {
  alertType: PortfolioAlertType
  enabled: boolean
}

export type CoachRequest = {
  message: string
  walletAddress?: string
}

/** Phase 10.5 — portfolio analytics (API response). */
export type AllocationSlice = {
  mint: string
  symbol: string
  weight: number
  valueUsd: number
}

export type HoldingAnalytics = {
  mint: string
  symbol: string
  amount: number
  valueUsd: number
  priceUsd: number
  avgEntryPriceUsd: number | null
  unrealizedPnlUsd: number | null
  realizedPnlUsd: number | null
  allocationPct: number
  riskScore: number | null
}

export type PortfolioAnalytics = {
  walletAddress: string
  totalValueUsd: number
  unrealizedPnl: number | null
  realizedPnl: number | null
  winRate: number | null
  allocation: AllocationSlice[]
  riskExposure: number | null
  concentration: number
  diversification: number
  correlationMatrix: {
    mints: string[]
    symbols: string[]
    matrix: (number | null)[][]
  }
  holdings: HoldingAnalytics[]
  avgEntryByMint: Record<string, number | null>
  limitations: string | null
  fetchedAt: string
}

export type ReviewAction = 'Hold' | 'Buy' | 'Reduce' | 'Exit'

export type HoldingRecommendation = {
  mint: string
  symbol: string
  action: ReviewAction
  rationale: string
}

export type PortfolioReviewResponse = {
  walletAddress: string
  recommendations: HoldingRecommendation[]
  summary: string
  disclaimer: string
  limitations: string | null
  fetchedAt: string
}

export type TerminalOrderType = 'limit' | 'dca' | 'tp' | 'sl'

/** Honest lifecycle: filled only after a real wallet signature. */
export type TerminalOrderStatus =
  | 'pending'
  | 'trigger_hit'
  | 'filled'
  | 'cancelled'
  | 'expired'

export type TerminalOrder = {
  id: string
  wallet: string
  type: TerminalOrderType
  status: TerminalOrderStatus
  inputMint: string
  outputMint: string
  amount: number
  triggerPrice: number | null
  fillSignature: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}
