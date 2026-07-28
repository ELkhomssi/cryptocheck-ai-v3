/**
 * Terminal OS v6 — shared domain contracts.
 * UI components consume these types only; providers supply instances.
 */

export type ChainId = 'solana' | 'bnb' | 'ethereum' | 'base' | 'arbitrum' | 'all'

export type RiskBand = 'very_low' | 'low' | 'moderate' | 'high' | 'critical'

export type ScoreBand = 'excellent' | 'good' | 'caution' | 'danger'

export type PanelStatus = 'loading' | 'empty' | 'error' | 'ready'

export type WhaleClassification =
  | 'Accumulation'
  | 'Distribution'
  | 'Liquidity Migration'
  | 'Profit Taking'
  | 'High Conviction Buy'
  | 'Possible Rug'
  | 'Exit Signal'

export type WhaleAction = 'buy' | 'sell' | 'swap' | 'withdraw' | 'deposit'

export interface TickerQuote {
  symbol: string
  priceUsd: number
  change24hPct: number
}

export interface TopTrader {
  id: string
  handle: string
  avatarInitials: string
  pnlUsd: number
  pnlPct: number
  winRatePct: number
  activePositions: number
  aiConfidence: number
  /** Plain-language why the confidence score exists */
  confidenceWhy: string
  volume24hUsd?: number
  priceUsd?: number
  marketCapUsd?: number
  logoUrl?: string
  /** Live asset the desk is ranked on (algorithmic persona mapping) */
  underlyingSymbol?: string
}

export interface WhaleMovement {
  id: string
  walletTruncated: string
  chain: ChainId
  action: WhaleAction
  assetSymbol: string
  usdValue: number
  amount: number
  occurredAt: string // ISO
  classification: WhaleClassification
  classificationWhy: string
}

export interface TokenRow {
  id: string
  symbol: string
  name: string
  chain: ChainId
  priceUsd: number
  change24hPct: number
  volume24hUsd: number
  liquidityUsd: number
  marketCapUsd: number
  txCount24h: number
  buySellRatio: number
  sparkline: number[]
  logoUrl?: string
  pairAddress?: string
}

export interface MarketOverview {
  marketCapUsd: number
  volume24hUsd: number
  btcDominancePct: number
  altcoinIndex: number
  marketCapChange24hPct: number
  fetchedAt: string
  source: string
}

export interface CandleBar {
  time: number // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ChainMarketSnapshot {
  chain: ChainId
  label: string
  topTokens: TokenRow[]
  candles: CandleBar[]
}

export interface MetricBar {
  label: string
  value: number // 0-100
  why: string
}

export interface TokenScanResult {
  mintOrAddress: string
  symbol: string
  score: number
  band: ScoreBand
  riskLabel: string
  confidence: number
  explanation: string
  recommendedAction: string
  metrics: MetricBar[]
}

export interface WalletScanResult {
  address: string
  addressTruncated: string
  score: number
  band: ScoreBand
  riskLabel: string
  confidence: number
  explanation: string
  recommendedAction: string
}

export interface SwapQuotePreview {
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  toAmount: number
  priceImpactPct: number
  platformFeeBps: number
  /** Feature-flag gated; Phase 1 never executes */
  executable: boolean
}

export interface AiLearningStatus {
  phase: 'idle' | 'learning' | 'ready' | 'paused'
  progressPct: number
  analyzing: string[]
  why: string
}

export interface AiAlertItem {
  id: string
  kind: 'token' | 'whale' | 'coach' | 'risk'
  title: string
  body: string
  occurredAt: string
  confidence: number
}

export interface CoachInsight {
  id: string
  headline: string
  reasoning: string
  statistic: string
  expectedImpact: string
  confidence: number
}

export interface DiscoveryOpportunity {
  id: string
  symbol: string
  name: string
  opportunityScore: number
  risk: RiskBand
  narrative: string
  catalyst: string
  confidence: number
  timeHorizon: string
  why: string
}

export interface PortfolioHealthSummary {
  totalAssetsUsd: number
  pnl24hUsd: number
  pnl24hPct: number
  diversificationScore: number
  aiHealthScore: number
  stabilityScore: number
  healthWhy: string
  stabilityWhy: string
}

export type AutonomyPermissionTier =
  | 'advise_only'
  | 'execute_with_confirmation'
  | 'bounded_autonomy'
  | 'full_autonomy'

export interface FeatureFlags {
  /** Phase 6 — default OFF */
  autonomousTrading: boolean
  /** Copy trading surfaces — default OFF */
  copyTrading: boolean
  /** Real swap execution — default OFF in Phase 1 */
  realSwapExecution: boolean
}

export type TerminalNavId =
  | 'terminal'
  | 'ai-scanner'
  | 'market-intel'
  | 'whale-tracking'
  | 'ai-trading'
  | 'copy-trading'
  | 'portfolio'
  | 'alerts'
  | 'watchlist'
  | 'settings'
  | 'ai-workforce'
  | 'discovery'
  | 'security'
  | 'ai-coach'
