/**
 * Phase 1 mock providers — simulate latency; swap for live in Phase 2.
 */

import type {
  IAiCoachProvider,
  IAiTradeLikeMeProvider,
  IDiscoveryProvider,
  IMarketDataProvider,
  IPortfolioOsProvider,
  IRealtimeChannel,
  ISecurityScanProvider,
  ISwapQuoteProvider,
  ITraderLeaderboardProvider,
  IWhaleFeedProvider,
} from './providers'
import {
  MOCK_AI_ALERTS,
  MOCK_COACH,
  MOCK_DISCOVERY,
  MOCK_LEARNING,
  MOCK_PORTFOLIO,
  MOCK_SWAP,
  MOCK_TICKER,
  MOCK_TOKEN_SCAN,
  MOCK_TOKENS,
  MOCK_TOP_TRADERS,
  MOCK_WALLET_SCAN,
  MOCK_WHALES,
  MOCK_MARKET_OVERVIEW,
  mockChainSnapshots,
} from './mock-data'
import type { ChainId } from '../types'

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))

export const mockMarketDataProvider: IMarketDataProvider = {
  async getTickerQuotes() {
    await delay()
    return MOCK_TICKER
  },
  async getTopTokens(chain: ChainId) {
    await delay()
    if (chain === 'all') return MOCK_TOKENS
    return MOCK_TOKENS.filter((t) => t.chain === chain)
  },
  async getChainSnapshots() {
    await delay(220)
    return mockChainSnapshots()
  },
  async getCandles(chain: ChainId) {
    await delay()
    const snap = mockChainSnapshots().find((s) => s.chain === chain)
    return snap?.candles ?? []
  },
  async getMarketOverview() {
    await delay()
    return { ...MOCK_MARKET_OVERVIEW, fetchedAt: new Date().toISOString() }
  },
}

export const mockWhaleFeedProvider: IWhaleFeedProvider = {
  async getRecentMovements(limit = 20) {
    await delay()
    return MOCK_WHALES.slice(0, limit)
  },
}

export const mockTraderLeaderboardProvider: ITraderLeaderboardProvider = {
  async getTopTradersToday() {
    await delay()
    return MOCK_TOP_TRADERS
  },
}

export const mockSecurityScanProvider: ISecurityScanProvider = {
  async scanToken(query: string) {
    await delay(240)
    const q = query.trim().toUpperCase()
    if (!q) throw new Error('Enter a token mint or symbol')
    return {
      ...MOCK_TOKEN_SCAN,
      symbol: q.length <= 8 ? q : MOCK_TOKEN_SCAN.symbol,
      mintOrAddress: query.trim() || MOCK_TOKEN_SCAN.mintOrAddress,
    }
  },
  async scanWallet(query: string) {
    await delay(240)
    if (!query.trim()) throw new Error('Enter a wallet address')
    const a = query.trim()
    return {
      ...MOCK_WALLET_SCAN,
      address: a,
      addressTruncated:
        a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : MOCK_WALLET_SCAN.addressTruncated,
    }
  },
}

export const mockSwapQuoteProvider: ISwapQuoteProvider = {
  async preview(fromSymbol, toSymbol, amount) {
    await delay()
    return {
      ...MOCK_SWAP,
      fromSymbol,
      toSymbol,
      fromAmount: amount,
      toAmount: amount * (fromSymbol === 'SOL' ? 184.12 : 1),
      executable: false,
    }
  },
}

export const mockAiTradeLikeMeProvider: IAiTradeLikeMeProvider = {
  async getLearningStatus() {
    await delay()
    return MOCK_LEARNING
  },
  async getAlerts(limit = 10) {
    await delay()
    return MOCK_AI_ALERTS.slice(0, limit)
  },
}

export const mockAiCoachProvider: IAiCoachProvider = {
  async getInsights() {
    await delay()
    return MOCK_COACH
  },
}

export const mockDiscoveryProvider: IDiscoveryProvider = {
  async getOpportunities() {
    await delay()
    return MOCK_DISCOVERY
  },
}

export const mockPortfolioOsProvider: IPortfolioOsProvider = {
  async getHealthSummary() {
    await delay()
    return MOCK_PORTFOLIO
  },
}

/** No-op realtime until Phase 2 */
export const mockRealtimeChannel: IRealtimeChannel = {
  subscribe() {
    return () => undefined
  },
  isConnected() {
    return false
  },
}
