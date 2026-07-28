/**
 * Provider ports — Phase 2 will swap mock implementations for live feeds
 * without touching panel UI.
 */

import type {
  AiAlertItem,
  AiLearningStatus,
  CandleBar,
  ChainId,
  ChainMarketSnapshot,
  CoachInsight,
  DiscoveryOpportunity,
  MarketOverview,
  PortfolioHealthSummary,
  SwapQuotePreview,
  TickerQuote,
  TokenRow,
  TokenScanResult,
  TopTrader,
  WalletScanResult,
  WhaleMovement,
} from '../types'

export interface IMarketDataProvider {
  getTickerQuotes(): Promise<TickerQuote[]>
  getTopTokens(chain: ChainId): Promise<TokenRow[]>
  getChainSnapshots(): Promise<ChainMarketSnapshot[]>
  getCandles(chain: ChainId): Promise<CandleBar[]>
  getMarketOverview(): Promise<MarketOverview | null>
}

export interface IWhaleFeedProvider {
  getRecentMovements(limit?: number): Promise<WhaleMovement[]>
}

export interface ITraderLeaderboardProvider {
  getTopTradersToday(): Promise<TopTrader[]>
}

export interface ISecurityScanProvider {
  scanToken(query: string): Promise<TokenScanResult>
  scanWallet(query: string): Promise<WalletScanResult>
}

export interface ISwapQuoteProvider {
  preview(fromSymbol: string, toSymbol: string, amount: number): Promise<SwapQuotePreview>
}

export interface IAiTradeLikeMeProvider {
  getLearningStatus(): Promise<AiLearningStatus>
  getAlerts(limit?: number): Promise<AiAlertItem[]>
}

export interface IAiCoachProvider {
  getInsights(): Promise<CoachInsight[]>
}

export interface IDiscoveryProvider {
  getOpportunities(): Promise<DiscoveryOpportunity[]>
}

export interface IPortfolioOsProvider {
  getHealthSummary(): Promise<PortfolioHealthSummary>
}

/** Realtime channel port — Phase 2 wires WebSocket / polling fallback */
export interface IRealtimeChannel {
  subscribe(topic: string, handler: (payload: unknown) => void): () => void
  isConnected(): boolean
}

/** Reasoning engine port — Phase 3+ */
export interface IReasoningEngine {
  reason(prompt: string, context: Record<string, unknown>): Promise<{
    text: string
    confidence: number
  }>
}
