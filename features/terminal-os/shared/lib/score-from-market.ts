/**
 * Derive token scores from live DexScreener metrics.
 * Weighted institutional rubric — explainable, deterministic.
 */

import type { MetricBar, ScoreBand, TokenScanResult, TokenRow } from '@/features/terminal-os/shared/types'
import { scoreToBand } from '@/features/terminal-os/shared/lib/score-band'

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function logScore(usd: number, pivot: number): number {
  // Soft logistic around pivot USD
  const x = Math.log10(Math.max(usd, 1)) - Math.log10(pivot)
  return clamp(50 + x * 28)
}

/**
 * Weights (sum=1):
 * liquidity 0.28 · volume 0.20 · holdersProxy 0.18 · buyPressure 0.16 · stability 0.18
 */
export function scoreTokenFromMarket(token: TokenRow): TokenScanResult {
  const liq = logScore(token.liquidityUsd, 250_000)
  const vol = logScore(token.volume24hUsd, 500_000)
  const holdersProxy = clamp(38 + Math.min(55, Math.sqrt(Math.max(token.txCount24h, 0)) / 2.2))
  const buyPressure = clamp(50 + (token.buySellRatio - 1) * 28)
  const stability = clamp(82 - Math.min(55, Math.abs(token.change24hPct) * 1.35))

  const score = clamp(
    liq * 0.28 + vol * 0.2 + holdersProxy * 0.18 + buyPressure * 0.16 + stability * 0.18,
  )
  const band: ScoreBand = scoreToBand(score)

  const contractSafety = clamp(
    62 +
      (token.liquidityUsd > 100_000 ? 12 : 0) +
      (token.liquidityUsd > 1_000_000 ? 10 : 0) +
      (token.txCount24h > 500 ? 6 : 0) -
      (Math.abs(token.change24hPct) > 40 ? 12 : 0),
  )

  const metrics: MetricBar[] = [
    { label: 'Liquidity', value: liq, why: `Pool $${Math.round(token.liquidityUsd).toLocaleString()}` },
    { label: 'Contract Safety', value: contractSafety, why: 'Heuristic from depth, activity, and volatility.' },
    { label: 'Holders', value: holdersProxy, why: `Tx activity proxy ${token.txCount24h.toLocaleString()}/24h` },
    { label: 'Dev Activity', value: buyPressure, why: `Buy/sell ratio ${token.buySellRatio.toFixed(2)}` },
    { label: 'Community', value: vol, why: `24h volume $${Math.round(token.volume24hUsd).toLocaleString()}` },
  ]

  const riskLabel =
    band === 'excellent'
      ? 'Very Low Risk'
      : band === 'good'
        ? 'Low Risk'
        : band === 'caution'
          ? 'Elevated Risk'
          : 'High Risk'

  return {
    mintOrAddress: token.id,
    symbol: token.symbol,
    score,
    band,
    riskLabel,
    confidence: clamp(58 + liq * 0.22 + (token.liquidityUsd > 500_000 ? 8 : 0)),
    explanation: `Institutional rubric on live DexScreener metrics for $${token.symbol} (${token.chain}).`,
    recommendedAction:
      band === 'danger'
        ? 'Avoid or micro-size — confirm rug heuristics before any swap.'
        : band === 'caution'
          ? 'Proceed only with tight size and hard slippage limits.'
          : 'Eligible for normal swap flow — still verify size vs. liquidity.',
    metrics,
  }
}
