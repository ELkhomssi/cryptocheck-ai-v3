/**
 * Market Intelligence Engine V2 — emits normalized MarketContext.
 * Reuses Terminal OS live providers; does not rebuild scanners.
 */

import type { ChainId, TokenRow, WhaleMovement } from '@/features/terminal-os/shared/types'
import type { MarketContext } from '../types'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export type MarketIntelInput = {
  token: TokenRow
  whales?: WhaleMovement[]
  tokenScore?: number
  walletQuality?: number
  riskScore?: number
  securityBand?: MarketContext['securityBand']
}

export function buildMarketIntel(input: MarketIntelInput): MarketContext {
  const { token, whales = [] } = input
  const related = whales.filter(
    (w) =>
      w.assetSymbol.toUpperCase() === token.symbol.toUpperCase() || w.chain === token.chain,
  )
  const buyWhales = related.filter((w) => w.action === 'buy' || w.action === 'deposit').length
  const sellWhales = related.filter((w) => w.action === 'sell' || w.action === 'withdraw').length
  let whaleBias: MarketContext['whaleBias'] = 'neutral'
  if (buyWhales > sellWhales + 1) whaleBias = 'accumulating'
  else if (sellWhales > buyWhales + 1) whaleBias = 'distributing'

  const change = token.change24hPct
  const liqTrend: MarketContext['liquidityTrend'] =
    change > 4 && token.liquidityUsd > 100_000
      ? 'increasing'
      : change < -6
        ? 'decreasing'
        : 'stable'

  const volumeScore = clamp(Math.log10(Math.max(token.volume24hUsd, 1)) * 12, 5, 99)
  const volatilityPct = Math.abs(change)
  const smartMoney =
    related.length > 0
      ? clamp(avg(related.map((w) => w.smartMoneyScore)), 10, 99)
      : clamp(40 + token.buySellRatio * 12, 10, 85)

  const tokenScore =
    input.tokenScore ?? clamp(50 + change * 1.2 + (token.buySellRatio - 1) * 15, 8, 95)
  const riskScore =
    input.riskScore ??
    clamp(100 - tokenScore + (token.liquidityUsd < 50_000 ? 20 : 0), 5, 95)
  const securityBand =
    input.securityBand ??
    (riskScore >= 70 ? 'danger' : riskScore >= 50 ? 'caution' : riskScore >= 30 ? 'good' : 'excellent')

  const orderFlowBias: MarketContext['orderFlowBias'] =
    token.buySellRatio >= 1.15 ? 'buy' : token.buySellRatio <= 0.85 ? 'sell' : 'mixed'

  const volLiq = token.liquidityUsd > 0 ? token.volume24hUsd / token.liquidityUsd : 0
  const whaleActivityScore =
    related.length > 0
      ? clamp(avg(related.map((w) => w.impactScore)), 5, 99)
      : clamp(40 + (whaleBias === 'accumulating' ? 20 : whaleBias === 'distributing' ? -15 : 0), 5, 90)

  const predictionUpsidePct = Number(
    clamp(
      change * 0.35 +
        (whaleBias === 'accumulating' ? 8 : whaleBias === 'distributing' ? -6 : 0) +
        (liqTrend === 'increasing' ? 4 : 0),
      -40,
      45,
    ).toFixed(1),
  )

  const conditionVector: Record<string, number> = {
    whaleActivityScore,
    volumeToLiquidityRatio: clamp(volLiq * 10, 0, 100),
    tokenScore,
    riskScore: 100 - riskScore,
    volatility24h: clamp(volatilityPct, 0, 100),
    socialMomentum: clamp(50 + change, 0, 100),
    newsSentiment: clamp(50 + change * 0.8, 0, 100),
    liquidityRising: liqTrend === 'increasing' ? 80 : liqTrend === 'decreasing' ? 20 : 50,
  }

  return {
    tokenSymbol: token.symbol,
    tokenAddress: token.id,
    chain: token.chain as ChainId,
    whaleBias,
    liquidityTrend: liqTrend,
    smartMoneyScore: Math.round(smartMoney),
    walletQuality: input.walletQuality ?? clamp(55 + smartMoney * 0.2, 10, 95),
    tokenScore: Math.round(tokenScore),
    securityBand,
    riskScore: Math.round(riskScore),
    newsSentiment: clamp(50 + change * 0.8, 5, 95),
    marketSentiment: clamp(50 + change * 1.1, 5, 95),
    orderFlowBias,
    volumeScore: Math.round(volumeScore),
    volatilityPct: Number(volatilityPct.toFixed(2)),
    volumeToLiquidityRatio: Number(volLiq.toFixed(3)),
    whaleActivityScore: Math.round(whaleActivityScore),
    predictionUpsidePct,
    conditionVector,
    sources: ['dexscreener', 'whale-feed', 'terminal-os-market'],
    fetchedAt: new Date().toISOString(),
  }
}

export class MarketIntelligenceEngine {
  snapshot(input: MarketIntelInput): MarketContext {
    return buildMarketIntel(input)
  }
}
