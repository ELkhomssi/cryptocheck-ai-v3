/**
 * Server-side screener scoring (Phase 10.3).
 * Import only from API / server modules — never from client components.
 */

import type { TokenMarketMetrics } from '@/lib/providers/types'

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, n))
}

function logNorm(value: number, ref: number): number {
  const v = Math.max(0, value)
  const r = Math.max(1, ref)
  return Math.log10(v + 1) / Math.log10(r + 1)
}

/**
 * Risk score 0–100 (higher = riskier).
 *
 * Heuristic (documented, not a substitute for full scan pipeline):
 * - Low liquidity ……… up to 40 pts
 *     < $10k → 40 · < $50k → 30 · < $200k → 20 · < $1M → 10 · else 0
 * - |24h change| ……… up to 30 pts
 *     ≥ 50% → 30 · ≥ 25% → 20 · ≥ 10% → 10 · else floor(|chg| / 2) capped at 8
 * - |5m change| ……… up to 20 pts
 *     ≥ 20% → 20 · ≥ 10% → 12 · ≥ 5% → 6 · else 0
 * - Thin holders ……… up to 10 pts
 *     < 50 → 10 · < 200 → 6 · < 1_000 → 3 · else 0
 *
 * Result is clamped to [0, 100] and rounded.
 */
export function computeRiskScore(m: TokenMarketMetrics): number {
  const liq = m.liquidityUsd ?? 0
  let liqPts = 0
  if (liq < 10_000) liqPts = 40
  else if (liq < 50_000) liqPts = 30
  else if (liq < 200_000) liqPts = 20
  else if (liq < 1_000_000) liqPts = 10

  const abs24 = Math.abs(m.change24hPct ?? 0)
  let chgPts = 0
  if (abs24 >= 50) chgPts = 30
  else if (abs24 >= 25) chgPts = 20
  else if (abs24 >= 10) chgPts = 10
  else chgPts = Math.min(8, Math.floor(abs24 / 2))

  const abs5 = Math.abs(m.change5mPct ?? 0)
  let vol5Pts = 0
  if (abs5 >= 20) vol5Pts = 20
  else if (abs5 >= 10) vol5Pts = 12
  else if (abs5 >= 5) vol5Pts = 6

  const holders = m.holders ?? 0
  let holderPts = 0
  if (holders < 50) holderPts = 10
  else if (holders < 200) holderPts = 6
  else if (holders < 1_000) holderPts = 3

  return Math.round(clamp(liqPts + chgPts + vol5Pts + holderPts, 0, 100))
}

/**
 * AI score 0–100 (higher = stronger composite market quality signal).
 *
 * Heuristic composite (documented):
 * - Volume weight …… 0–35  via logNorm(volume24hUsd, 10_000_000)
 * - Liquidity weight · 0–30  via logNorm(liquidityUsd, 5_000_000)
 * - Holders weight … 0–25  via logNorm(holders, 50_000)
 * - Activity bonus … 0–10  via min(10, txCount24h / 500 * 10)
 *
 * Result is clamped to [0, 100] and rounded. Not a model inference —
 * a deterministic market-structure proxy for screener ranking.
 */
export function computeAiScore(m: TokenMarketMetrics): number {
  const volPts = logNorm(m.volume24hUsd ?? 0, 10_000_000) * 35
  const liqPts = logNorm(m.liquidityUsd ?? 0, 5_000_000) * 30
  const holderPts = logNorm(m.holders ?? 0, 50_000) * 25
  const tx = Math.max(0, m.txCount24h ?? 0)
  const activityPts = Math.min(10, (tx / 500) * 10)
  return Math.round(clamp(volPts + liqPts + holderPts + activityPts, 0, 100))
}

/**
 * Smart-money proxy 0–100 from buy/sell ratio (server-side only).
 * ratio ≥ 2 → 100, 1 → 50, ≤ 0.5 → 0; linear between.
 */
export function computeSmartMoneyScore(m: TokenMarketMetrics): number {
  const r = m.buySellRatio ?? 1
  if (r >= 2) return 100
  if (r <= 0.5) return 0
  if (r >= 1) return Math.round(50 + ((r - 1) / 1) * 50)
  return Math.round(((r - 0.5) / 0.5) * 50)
}
