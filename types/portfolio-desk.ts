/** Shared contracts for the CryptoCheck Portfolio desk (playbook). */

export type PortfolioTheme = 'dark' | 'light'

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
