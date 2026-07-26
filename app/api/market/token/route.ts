/**
 * GET /api/market/token?mint=
 * Single-token live metrics — Birdeye overview, then DexScreener / Jupiter / Helius.
 * ~50–300ms estimated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchTokenMarket } from '@/lib/providers/birdeye'
import { fetchTokenMetricsFromDex } from '@/lib/providers/dexscreener'
import { getAsset, heliusAssetMeta } from '@/lib/providers/helius'
import { fetchPrices } from '@/lib/providers/jupiter'
import type { ScreenerRow, TokenMarketMetrics } from '@/lib/providers/types'
import {
  computeAiScore,
  computeRiskScore,
  computeSmartMoneyScore,
} from '@/lib/terminal/scoring'
import { isValidSolanaAddress } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

function toRow(overview: TokenMarketMetrics): ScreenerRow {
  const row: ScreenerRow = {
    ...overview,
    riskScore: 0,
    aiScore: 0,
    isPumpFun: false,
    isRaydium: false,
    isGraduated: false,
    isVerified: false,
    isTrending: false,
    smartMoneyScore: 0,
  }
  row.riskScore = computeRiskScore(row)
  row.aiScore = computeAiScore(row)
  row.smartMoneyScore = computeSmartMoneyScore(row)
  return row
}

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const mint = (req.nextUrl.searchParams.get('mint') || '').trim()

  if (!mint || !isValidSolanaAddress(mint)) {
    return NextResponse.json({ error: 'Invalid mint address' }, { status: 400 })
  }

  // ~50–150ms estimated
  let overview = await fetchTokenMarket(mint)
  let source = overview ? 'birdeye' : ''

  if (!overview) {
    // ~50–150ms estimated
    overview = await fetchTokenMetricsFromDex(mint)
    if (overview) source = 'dexscreener'
  }

  if (!overview) {
    const [prices, asset] = await Promise.all([
      fetchPrices([mint]),
      getAsset(mint),
    ])
    const price = prices.get(mint)
    const meta = heliusAssetMeta(asset)
    if (price || meta.symbol || meta.name) {
      overview = {
        mint,
        symbol: meta.symbol,
        name: meta.name,
        logoUrl: meta.logoUrl,
        priceUsd: price?.priceUsd ?? meta.priceUsd ?? 0,
        change5mPct: 0,
        change1hPct: 0,
        change24hPct: typeof price?.change24hPct === 'number' ? price.change24hPct : 0,
        volume24hUsd: 0,
        liquidityUsd: 0,
        marketCapUsd: 0,
        fdvUsd: 0,
        holders: 0,
        txCount24h: 0,
        buySellRatio: 0,
      }
      source = price && meta.symbol ? 'jupiter+helius' : price ? 'jupiter' : 'helius'
    }
  } else {
    // Fill sparse identity from Helius when Birdeye/Dex omit symbol/logo
    if (!overview.symbol || !overview.logoUrl) {
      const meta = heliusAssetMeta(await getAsset(mint))
      overview = {
        ...overview,
        symbol: overview.symbol || meta.symbol,
        name: overview.name || meta.name,
        logoUrl: overview.logoUrl || meta.logoUrl,
      }
      if (meta.symbol || meta.logoUrl) source = `${source}+helius`
    }
  }

  if (!overview) {
    return NextResponse.json(
      {
        mint,
        available: false,
        error: 'Token market data unavailable',
        latencyMs: Date.now() - t0,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    token: toRow(overview),
    available: true,
    source,
    latencyMs: Date.now() - t0,
  })
}
