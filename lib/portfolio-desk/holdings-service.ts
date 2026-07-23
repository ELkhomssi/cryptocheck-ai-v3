import 'server-only'

import type { Holding, HoldingsResponse } from '@/types/portfolio-desk'
import { SOL_MINT } from './constants'
import { fetchWalletHoldings } from './helius'
import { fetchJupiterPrices } from './jupiter'

const DUST_USD = 0.5

export async function buildHoldingsResponse(walletAddress: string): Promise<HoldingsResponse> {
  const raw = await fetchWalletHoldings(walletAddress)
  const prices = await fetchJupiterPrices(raw.map((h) => h.mint))

  const priced = raw.map((h) => {
    const px = prices.get(h.mint)?.priceUsd ?? 0
    const change24hPct = prices.get(h.mint)?.change24hPct ?? null
    const valueUsd = h.amount * px
    return { h, px, change24hPct, valueUsd }
  })

  const filtered = priced.filter((p) => p.valueUsd >= DUST_USD || p.h.isNativeSol)
  const totalValueUsd = filtered.reduce((s, p) => s + p.valueUsd, 0)

  const holdings: Holding[] = filtered
    .map(({ h, px, change24hPct, valueUsd }) => ({
      mint: h.mint,
      symbol: h.symbol,
      name: h.name,
      logoUrl: h.logoUrl,
      amount: h.amount,
      valueUsd,
      priceUsd: px,
      change24hPct,
      avgBuyPriceUsd: null, // needs tx history — Step 7
      allocationPct: totalValueUsd > 0 ? (valueUsd / totalValueUsd) * 100 : 0,
      decimals: h.decimals,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd)

  const sol = holdings.find((h) => h.mint === SOL_MINT)

  return {
    walletAddress,
    totalValueUsd,
    holdings,
    availableSol: sol?.amount ?? 0,
    availableSolUsd: sol?.valueUsd ?? 0,
    fetchedAt: new Date().toISOString(),
  }
}
