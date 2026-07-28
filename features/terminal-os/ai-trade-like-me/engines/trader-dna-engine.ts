/**
 * Trader DNA Engine V2 — weighted style vector (sums to 1.0),
 * ConditionRange profiles, confidence + sampleSize as retention metrics.
 */

import type {
  CapturedTrade,
  ConditionRange,
  StyleVector,
  StyleVectorKey,
  TraderDna,
  WeightedTag,
} from '../types'
import type { TlmEventBus } from './event-bus'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

const STYLE_KEYS: StyleVectorKey[] = [
  'momentum',
  'scalper',
  'swingTrader',
  'narrativeTrader',
  'whaleFollower',
  'meanReversion',
  'breakoutTrader',
  'liquidityHunter',
]

export function emptyStyleVector(): StyleVector {
  return {
    momentum: 0,
    scalper: 0,
    swingTrader: 0,
    narrativeTrader: 0,
    whaleFollower: 0,
    meanReversion: 0,
    breakoutTrader: 0,
    liquidityHunter: 0,
  }
}

/** Recompute style vector on every new trade — sums to 1.0 */
export function computeStyleVector(trades: CapturedTrade[]): StyleVector {
  const executed = trades.filter((t) => !t.wasRejectedOpportunity)
  const raw = emptyStyleVector()
  if (!executed.length) {
    raw.momentum = 1
    return raw
  }

  const holds = executed
    .map((t) => t.holdingDurationMs)
    .filter((h): h is number => h != null && h > 0)
  const avgHold = avg(holds)
  const vols = executed.map((t) => t.contextAtEntry.volatility24h)
  const whale = executed.map((t) => t.contextAtEntry.whaleActivityScore)
  const mcaps = executed.map((t) => t.entry.marketCap)
  const liqs = executed.map((t) => t.entry.liquidity)
  const ratios = executed.map((t) => t.contextAtEntry.volumeToLiquidityRatio)

  if (avgHold > 0 && avgHold < 30 * 60_000) raw.scalper += 40
  if (avgHold >= 30 * 60_000 && avgHold < 12 * 3_600_000) raw.momentum += 28
  if (avgHold >= 12 * 3_600_000) raw.swingTrader += 35
  if (avg(vols) > 12) raw.momentum += 18
  if (avg(whale) > 60) raw.whaleFollower += 32
  if (avg(mcaps) > 0 && avg(mcaps) < 50_000_000) raw.narrativeTrader += 22
  if (avg(liqs) > 500_000) raw.liquidityHunter += 26
  if (avg(ratios) > 8) raw.breakoutTrader += 16
  if (avg(vols) > 15 && executed.filter((t) => (t.pnlPct ?? 0) > 0).length > executed.length * 0.25) {
    raw.meanReversion += 18
  }

  // Rejections dampen overconfidence in aggressive styles
  const rejects = trades.filter((t) => t.wasRejectedOpportunity).length
  if (rejects > 0) {
    raw.scalper *= 0.92
    raw.narrativeTrader *= 0.9
  }

  const total = STYLE_KEYS.reduce((s, k) => s + raw[k], 0) || 1
  const out = emptyStyleVector()
  for (const k of STYLE_KEYS) out[k] = Number((raw[k] / total).toFixed(4))
  // Fix float drift so sum === 1
  const sum = STYLE_KEYS.reduce((s, k) => s + out[k], 0)
  out.momentum = Number((out.momentum + (1 - sum)).toFixed(4))
  return out
}

function styleSummary(v: StyleVector): string {
  const labels: Record<StyleVectorKey, string> = {
    momentum: 'Momentum',
    scalper: 'Scalper',
    swingTrader: 'Swing',
    narrativeTrader: 'Narrative',
    whaleFollower: 'Whale follower',
    meanReversion: 'Mean reversion',
    breakoutTrader: 'Breakout',
    liquidityHunter: 'Liquidity hunter',
  }
  return STYLE_KEYS.map((k) => ({ k, w: v[k] }))
    .filter((x) => x.w >= 0.08)
    .sort((a, b) => b.w - a.w)
    .slice(0, 4)
    .map((x) => `${labels[x.k]} (${Math.round(x.w * 100)}%)`)
    .join(' · ')
}

function riskAppetiteScore(trades: CapturedTrade[]): { score: number; label: TraderDna['riskAppetiteLabel'] } {
  const executed = trades.filter((t) => !t.wasRejectedOpportunity)
  const sizes = executed.map((t) => t.positionSizeUsd)
  const risks = executed.map((t) => t.contextAtEntry.riskScore)
  const avgSize = avg(sizes)
  const avgRisk = avg(risks)
  // Rejected high-risk scans lower appetite
  const rejectedHighRisk = trades.filter(
    (t) => t.wasRejectedOpportunity && t.contextAtEntry.riskScore >= 65,
  ).length
  let score = clamp(avgRisk * 0.55 + Math.min(avgSize / 300, 40) - rejectedHighRisk * 4, 5, 98)
  const label: TraderDna['riskAppetiteLabel'] =
    score >= 75 ? 'degen' : score >= 55 ? 'aggressive' : score <= 35 ? 'conservative' : 'moderate'
  return { score: Math.round(score), label }
}

function favoriteChains(trades: CapturedTrade[]): WeightedTag[] {
  const counts = new Map<string, number>()
  for (const t of trades) {
    if (t.wasRejectedOpportunity) continue
    counts.set(t.token.chain, (counts.get(t.token.chain) ?? 0) + 1)
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
  return Array.from(counts.entries())
    .map(([tag, n]) => ({ tag, weight: Math.round((n / total) * 100) }))
    .sort((a, b) => b.weight - a.weight)
}

function sectors(trades: CapturedTrade[]): WeightedTag[] {
  const counts = new Map<string, number>()
  for (const t of trades) {
    if (t.wasRejectedOpportunity) continue
    const s = t.token.symbol.toUpperCase()
    const tag = /WIF|BONK|PEPE|DEGEN|MEME/.test(s)
      ? 'Memes'
      : /SOL|ETH|BNB|BTC/.test(s)
        ? 'Majors'
        : /AI|GPT|NEURAL/.test(s)
          ? 'AI'
          : 'Alt / Midcap'
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
  return Array.from(counts.entries())
    .map(([tag, n]) => ({ tag, weight: Math.round((n / total) * 100) }))
    .sort((a, b) => b.weight - a.weight)
}

function entryProfile(trades: CapturedTrade[]): ConditionRange[] {
  const buys = trades.filter((t) => !t.wasRejectedOpportunity && t.side === 'buy')
  const out: ConditionRange[] = []
  if (!buys.length) return out
  const avgWhale = avg(buys.map((t) => t.contextAtEntry.whaleActivityScore))
  const avgLiqTrend = avg(buys.map((t) => t.contextAtEntry.volumeToLiquidityRatio))
  const avgHold = avg(buys.map((t) => t.holdingDurationMs ?? 0).filter(Boolean))

  if (avgWhale >= 55) {
    out.push({
      field: 'whaleActivityScore',
      op: '>',
      value: Math.max(50, Math.round(avgWhale - 10)),
      weight: 0.82,
      label: `enters when whaleActivityScore > ${Math.max(50, Math.round(avgWhale - 10))}`,
      evidence: `Avg whale activity ${avgWhale.toFixed(0)}/100 on entries`,
    })
  }
  if (avgLiqTrend >= 2) {
    out.push({
      field: 'volumeToLiquidityRatio',
      op: '>',
      value: Number((avgLiqTrend * 0.7).toFixed(2)),
      weight: 0.74,
      label: 'liquidity / volume rising vs baseline',
      evidence: `Typical vol/liq ratio ${avgLiqTrend.toFixed(2)}`,
    })
  }
  if (avgHold > 0) {
    const hLo = Math.max(0.25, (avgHold / 3_600_000) * 0.4)
    const hHi = (avgHold / 3_600_000) * 1.6
    out.push({
      field: 'hourOfDay',
      op: 'between',
      value: hLo,
      valueHi: hHi,
      weight: 0.6,
      label: `typical hold window ~${hLo.toFixed(1)}–${hHi.toFixed(1)}h`,
      evidence: `Avg hold ${(avgHold / 3_600_000).toFixed(1)}h`,
    })
  }
  return out.slice(0, 5)
}

function exitProfile(trades: CapturedTrade[]): ConditionRange[] {
  const closed = trades.filter((t) => t.pnlPct != null && !t.wasRejectedOpportunity)
  const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnlPct ?? 0) < 0)
  const out: ConditionRange[] = []
  if (wins.length) {
    const tp = avg(wins.map((t) => t.pnlPct!))
    out.push({
      field: 'riskScore',
      op: '>',
      value: Number(tp.toFixed(1)),
      weight: 0.8,
      label: `take-profit near +${tp.toFixed(1)}%`,
      evidence: `${wins.length} winning exits`,
    })
  }
  if (losses.length) {
    const sl = Math.abs(avg(losses.map((t) => t.pnlPct!)))
    out.push({
      field: 'riskScore',
      op: '<',
      value: -Number(sl.toFixed(1)),
      weight: 0.78,
      label: `cut losses near −${sl.toFixed(1)}%`,
      evidence: `${losses.length} losing exits`,
    })
  }
  return out
}

/**
 * Retention confidence: grows with sample size (trades + rejections).
 * Visible everywhere — cost of leaving.
 */
export function computeDnaConfidence(sampleSize: number, winRatePct: number, discipline: number): number {
  const sizeTerm = Math.min(55, sampleSize * 3.2)
  const qualityTerm = winRatePct * 0.25 + discipline * 0.15
  return Math.round(clamp(sizeTerm + qualityTerm, 8, 96))
}

export function buildTraderDna(wallet: string, trades: CapturedTrade[]): TraderDna {
  const executed = trades.filter((t) => !t.wasRejectedOpportunity)
  const rejections = trades.filter((t) => t.wasRejectedOpportunity)
  const closed = executed.filter((t) => t.pnlPct != null)
  const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnlPct ?? 0) < 0)
  const holds = executed.map((t) => t.holdingDurationMs).filter((h): h is number => h != null)
  const styleVector = computeStyleVector(trades)
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
  const avgRoi = avg(closed.map((t) => t.pnlPct!))
  const lossTol = losses.length ? Math.abs(Math.min(...losses.map((t) => t.pnlPct!))) : 8
  const late = executed.filter((t) => t.hourOfDay >= 22 || t.hourOfDay <= 4)
  const emotional = clamp(20 + late.length * 4 + (lossTol > 20 ? 15 : 0), 5, 95)

  const sizes = executed.map((t) => t.positionSizeUsd)
  let sizeCv = 0
  if (sizes.length >= 2) {
    const m = avg(sizes)
    sizeCv = m > 0 ? Math.sqrt(avg(sizes.map((s) => (s - m) ** 2))) / m : 0
  }
  const discipline = clamp(48 + winRate * 0.35 - sizeCv * 25 + rejections.length * 1.5, 5, 99)
  const sampleSize = trades.length
  const confidence = computeDnaConfidence(sampleSize, winRate, discipline)
  const risk = riskAppetiteScore(trades)
  const entryConditionProfile = entryProfile(trades)
  const exitConditionProfile = exitProfile(trades)

  const styles = STYLE_KEYS.map((k) => ({ tag: k, weight: Math.round(styleVector[k] * 100) }))
    .filter((s) => s.weight >= 8)
    .sort((a, b) => b.weight - a.weight)

  return {
    wallet,
    updatedAt: new Date().toISOString(),
    styleVector,
    tradingStyleSummary: styleSummary(styleVector) || 'Insufficient history',
    riskAppetite: risk.score,
    riskAppetiteLabel: risk.label,
    favoriteSectors: sectors(trades),
    favoriteChains: favoriteChains(trades),
    avgHoldingMs: avg(holds),
    entryConditionProfile,
    exitConditionProfile,
    winRatePct: Number(winRate.toFixed(1)),
    avgRoiPct: Number(avgRoi.toFixed(2)),
    lossTolerancePct: Number(lossTol.toFixed(1)),
    disciplineScore: Math.round(discipline),
    emotionalBiasScore: Math.round(emotional),
    confidence,
    sampleSize,
    tradeCount: executed.length,
    rejectionCount: rejections.length,
    sample: trades.some((t) => t.sample) || undefined,
    confidenceScore: confidence,
    styles,
    typicalEntry: entryConditionProfile.map((c) => ({
      label: c.label,
      weight: c.weight,
      evidence: c.evidence,
    })),
    typicalExit: exitConditionProfile.map((c) => ({
      label: c.label,
      weight: c.weight,
      evidence: c.evidence,
    })),
  }
}

/** @deprecated — use computeStyleVector */
export function classifyTradingStyles(trades: CapturedTrade[]) {
  const v = computeStyleVector(trades)
  return STYLE_KEYS.map((tag) => ({ tag, weight: Math.round(v[tag] * 100) }))
    .filter((s) => s.weight >= 8)
    .sort((a, b) => b.weight - a.weight)
}

export class TraderDnaEngine {
  private dna: TraderDna | null = null

  constructor(private readonly bus: TlmEventBus) {}

  rebuild(wallet: string, trades: CapturedTrade[]): TraderDna {
    this.dna = buildTraderDna(wallet, trades)
    this.bus.publish(
      'DNAUpdated',
      {
        sampleSize: this.dna.sampleSize,
        confidence: this.dna.confidence,
        tradeCount: this.dna.tradeCount,
        rejectionCount: this.dna.rejectionCount,
      },
      'TraderDnaEngine',
    )
    return this.dna
  }

  getDna() {
    return this.dna
  }
}
