/** Shared market / provider types for Phase 10 terminal data layer. */

export type TokenPrice = {
  mint: string
  priceUsd: number
  change24hPct: number | null
}

export type TokenMarketMetrics = {
  mint: string
  symbol?: string
  name?: string
  priceUsd: number
  change5mPct: number
  change1hPct: number
  change24hPct: number
  volume24hUsd: number
  liquidityUsd: number
  marketCapUsd: number
  fdvUsd: number
  holders: number
  txCount24h: number
  buySellRatio: number
  logoUrl?: string
}

export type ScreenerRow = TokenMarketMetrics & {
  riskScore: number
  aiScore: number
  isPumpFun: boolean
  isRaydium: boolean
  isGraduated: boolean
  isVerified: boolean
  isTrending: boolean
  smartMoneyScore: number
}

export type OhlcvPoint = {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export type NewPool = {
  mint: string
  symbol: string
  name: string
  poolAddress: string
  liquidityUsd: number
  createdAt: number
  source: string
}
