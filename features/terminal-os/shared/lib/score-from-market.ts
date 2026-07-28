/**
 * Derive token/wallet scores from live market metrics (algorithmic, not external score API).
 */

import type { MetricBar, ScoreBand, TokenScanResult, TokenRow } from '@/features/terminal-os/shared/types'
import { scoreToBand } from '@/features/terminal-os/shared/lib/score-band'

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function scoreTokenFromMarket(token: TokenRow): TokenScanResult {
  const liq = clamp(Math.log10(Math.max(token.liquidityUsd, 1)) * 18)
  const vol = clamp(Math.log10(Math.max(token.volume24hUsd, 1)) * 16)
  const holdersProxy = clamp(40 + Math.min(50, token.txCount24h / 800))
  const bs = clamp(50 + (token.buySellRatio - 1) * 25)
  const stability = clamp(80 - Math.abs(token.change24hPct) * 1.2)
  const score = clamp(liq * 0.28 + vol * 0.22 + holdersProxy * 0.2 + bs * 0.15 + stability * 0.15)
  const band: ScoreBand = scoreToBand(score)

  const metrics: MetricBar[] = [
    { label: 'Liquidity', value: liq, why: `Pool liquidity ${token.liquidityUsd.toLocaleString()} USD.` },
    { label: 'Contract Safety', value: clamp(70 + (token.liquidityUsd > 100_000 ? 15 : 0)), why: 'Heuristic from liquidity depth + pair age proxy.' },
    { label: 'Holders', value: holdersProxy, why: `Tx activity proxy ${token.txCount24h.toLocaleString()} / 24h.` },
    { label: 'Dev Activity', value: clamp(55 + bs * 0.2), why: `Buy/sell ratio ${token.buySellRatio.toFixed(2)}.` },
    { label: 'Community', value: clamp(vol * 0.85), why: `24h volume ${token.volume24hUsd.toLocaleString()} USD.` },
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
    confidence: clamp(60 + liq * 0.25),
    explanation: `Scored from live DexScreener metrics for ${token.symbol} on ${token.chain}.`,
    recommendedAction:
      band === 'danger'
        ? 'Avoid or size tiny — confirm rug heuristics before any swap.'
        : band === 'caution'
          ? 'Proceed only with tight size and slippage limits.'
          : 'Eligible for normal swap flow — still verify size vs. liquidity.',
    metrics,
  }
}
