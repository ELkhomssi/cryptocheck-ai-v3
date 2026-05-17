import type { BondingToken } from './pump-curve'

export type TerminalView = 'discover' | 'trending' | 'trenches' | 'trade'
export type DiscoverFilter = 'movers' | 'new' | 'live' | 'migrated' | 'mayhem'
export type Side = 'buy' | 'sell'
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export interface Candle {
  o: number
  h: number
  l: number
  c: number
}

export interface TradeRow {
  id: string
  price: number
  amount: number
  total: number
  side: Side
  depth: number
  wallet: string
  time: string
  age: string
}

export interface TokenCard {
  id: string
  mint: string
  name: string
  ticker: string
  emoji: string
  gradient: string
  progress: number
  marketCap: number
  change24h: number
  volumeSol: number
  liquidityUsd: number
  buys: number
  sells: number
  graduated: boolean
  createdAt: number
  description: string
  raw: BondingToken
}

export interface DeployForm {
  name: string
  ticker: string
  description: string
  liquidity: number
}
