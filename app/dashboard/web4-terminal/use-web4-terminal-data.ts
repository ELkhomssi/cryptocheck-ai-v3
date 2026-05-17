'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type Web4MarketDto = {
  mint: string
  symbol: string
  name: string
  solUsd: number
  priceSol: number
  priceUsd: number
  change24h: number
  liquidity: number
  volume: number
  fdv: number
  source: string
  updatedAt: string
}

export type Web4SafeMemecoinDto = {
  id: string
  mint: string
  name: string
  ticker: string
  emoji: string
  gradient: string
  progress: number
  marketCap: number
  verdict: string
  safetyScore: number
}

export type Web4SafetyDto = {
  mint: string
  safetyPct: number
  verdict: string
  secure: boolean
  mintAuthority: string
  freezeAuthority: string
  updatedAt: string
}

export type Web4OhlcvCandleDto = {
  o: number
  h: number
  l: number
  c: number
  t: number
}

export type Web4PortfolioDto = {
  wallet: string
  solBalance: number
  totalUsd: number
  totalMad: number
  holdingsCount: number
  topHoldings: Array<{
    mint: string
    symbol: string
    name: string
    amount: number
    usd: number
  }>
  updatedAt: string
}

export type Web4TimeframeDto = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W'

const MARKET_POLL_MS = 30_000
const FEED_POLL_MS = 45_000
const SAFETY_POLL_MS = 90_000
const PORTFOLIO_POLL_MS = 45_000

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useWeb4TerminalData(
  activeMint: string,
  timeframe: Web4TimeframeDto,
  walletAddress: string | null,
) {
  const [market, setMarket] = useState<Web4MarketDto | null>(null)
  const [safeFeed, setSafeFeed] = useState<Web4SafeMemecoinDto[]>([])
  const [safety, setSafety] = useState<Web4SafetyDto | null>(null)
  const [ohlcv, setOhlcv] = useState<Web4OhlcvCandleDto[]>([])
  const [ohlcvSource, setOhlcvSource] = useState<string | null>(null)
  const [portfolio, setPortfolio] = useState<Web4PortfolioDto | null>(null)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [ohlcvError, setOhlcvError] = useState<string | null>(null)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refreshMarket = useCallback(async () => {
    try {
      const data = await readJson<Web4MarketDto>(
        `/api/web4-terminal/market?mint=${encodeURIComponent(activeMint)}`,
      )
      if (!mountedRef.current) return
      setMarket(data)
      setMarketError(null)
    } catch (e) {
      if (!mountedRef.current) return
      setMarketError(e instanceof Error ? e.message : 'Market unavailable')
    }
  }, [activeMint])

  const refreshFeed = useCallback(async () => {
    try {
      const data = await readJson<{ items: Web4SafeMemecoinDto[] }>('/api/web4-terminal/safe-feed')
      if (!mountedRef.current) return
      if (data.items?.length) setSafeFeed(data.items)
      setFeedError(null)
    } catch (e) {
      if (!mountedRef.current) return
      setFeedError(e instanceof Error ? e.message : 'Feed unavailable')
    }
  }, [])

  const refreshSafety = useCallback(async () => {
    try {
      const data = await readJson<Web4SafetyDto>(
        `/api/web4-terminal/safety?mint=${encodeURIComponent(activeMint)}`,
      )
      if (!mountedRef.current) return
      setSafety(data)
    } catch {
      if (!mountedRef.current) return
    }
  }, [activeMint])

  const refreshOhlcv = useCallback(async () => {
    try {
      const data = await readJson<{
        candles: Web4OhlcvCandleDto[]
        source: string
      }>(
        `/api/web4-terminal/ohlcv?mint=${encodeURIComponent(activeMint)}&timeframe=${encodeURIComponent(timeframe)}`,
      )
      if (!mountedRef.current) return
      if (data.candles?.length) {
        setOhlcv(data.candles)
        setOhlcvSource(data.source)
      }
      setOhlcvError(null)
    } catch (e) {
      if (!mountedRef.current) return
      setOhlcvError(e instanceof Error ? e.message : 'OHLCV unavailable')
    }
  }, [activeMint, timeframe])

  const refreshPortfolio = useCallback(async () => {
    if (!walletAddress) {
      setPortfolio(null)
      setPortfolioError(null)
      return
    }
    try {
      const data = await readJson<Web4PortfolioDto>('/api/web4-terminal/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      })
      if (!mountedRef.current) return
      setPortfolio(data)
      setPortfolioError(null)
    } catch (e) {
      if (!mountedRef.current) return
      setPortfolioError(e instanceof Error ? e.message : 'Portfolio unavailable')
    }
  }, [walletAddress])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    void refreshMarket()
    const id = window.setInterval(() => void refreshMarket(), MARKET_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshMarket])

  useEffect(() => {
    void refreshFeed()
    const id = window.setInterval(() => void refreshFeed(), FEED_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshFeed])

  useEffect(() => {
    void refreshSafety()
    const id = window.setInterval(() => void refreshSafety(), SAFETY_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshSafety])

  useEffect(() => {
    void refreshOhlcv()
  }, [refreshOhlcv])

  useEffect(() => {
    void refreshPortfolio()
    if (!walletAddress) return undefined
    const id = window.setInterval(() => void refreshPortfolio(), PORTFOLIO_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshPortfolio, walletAddress])

  return {
    market,
    safeFeed,
    safety,
    ohlcv,
    ohlcvSource,
    ohlcvError,
    portfolio,
    portfolioError,
    marketError,
    feedError,
    refreshMarket,
    refreshFeed,
    refreshSafety,
    refreshOhlcv,
    refreshPortfolio,
  }
}
