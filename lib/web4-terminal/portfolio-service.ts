import 'server-only'

import { rpcCall, fetchPortfolio } from '@/lib/helius-server'
import { fetchSolUsdPrice } from '@/lib/web4-terminal/market-service'

const WSOL = 'So11111111111111111111111111111111111111112'
const MAD_PER_USD = 10.05

export type Web4PortfolioHolding = {
  mint: string
  symbol: string
  name: string
  amount: number
  usd: number
}

export type Web4PortfolioSnapshot = {
  wallet: string
  solBalance: number
  totalUsd: number
  totalMad: number
  holdingsCount: number
  topHoldings: Web4PortfolioHolding[]
  updatedAt: string
}

async function fetchJupiterUsdPrices(mints: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(mints.filter((m) => m.length >= 32))]
  if (!unique.length) return {}

  try {
    const res = await fetch(`https://price.jup.ag/v6/price?ids=${unique.join(',')}`, {
      next: { revalidate: 30 },
    })
    const data = (await res.json()) as {
      data?: Record<string, { price?: number }>
    }
    const out: Record<string, number> = {}
    for (const mint of unique) {
      const p = data?.data?.[mint]?.price
      if (typeof p === 'number' && p > 0) out[mint] = p
    }
    return out
  } catch {
    return {}
  }
}

export async function getWeb4Portfolio(walletAddress: string): Promise<Web4PortfolioSnapshot> {
  const wallet = walletAddress.trim()
  if (wallet.length < 32) {
    throw new Error('Valid wallet address required')
  }

  const [lamports, holdings, solUsd] = await Promise.all([
    rpcCall<number>('getBalance', [wallet]),
    fetchPortfolio(wallet),
    fetchSolUsdPrice(),
  ])

  const solBalance = (typeof lamports === 'number' ? lamports : 0) / 1e9
  const mints = [WSOL, ...holdings.map((h) => h.mint)]
  const prices = await fetchJupiterUsdPrices(mints)
  const solPrice = prices[WSOL] ?? solUsd

  let totalUsd = solBalance * solPrice
  const valued = holdings.map((h) => {
    const usd = h.amount * (prices[h.mint] ?? 0)
    totalUsd += usd
    return {
      mint: h.mint,
      symbol: h.symbol,
      name: h.name,
      amount: h.amount,
      usd,
    }
  })

  valued.sort((a, b) => b.usd - a.usd)

  return {
    wallet,
    solBalance,
    totalUsd,
    totalMad: Math.round(totalUsd * MAD_PER_USD),
    holdingsCount: holdings.length,
    topHoldings: valued.slice(0, 8),
    updatedAt: new Date().toISOString(),
  }
}
