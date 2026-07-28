/**
 * Trader DNA Engine — builds adaptive behavioral profile from captured trades.
 * Pure functions + class; multiple style tags may coexist.
 */

import type { ChainId } from '@/features/terminal-os/shared/types'
import type {
  CapturedTrade,
  EntryExitCondition,
  TraderDna,
  TradingStyleTag,
} from '../types'
import type { TlmEventBus } from './event-bus'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function classifyTradingStyles(
  trades: CapturedTrade[],
): { tag: TradingStyleTag; weight: number }[] {
  if (trades.length === 0) return []

  const holds = trades
    .map((t) => t.holdingDurationMs)
    .filter((h): h is number => h != null && h > 0)
  const avgHold = avg(holds)
  const vols = trades.map((t) => t.volatilityPct ?? 0)
  const whale = trades.map((t) => t.whaleActivityScore ?? 0)
  const mcaps = trades.map((t) => t.marketCapUsd ?? 0)
  const liqs = trades.map((t) => t.liquidityUsd ?? 0)
  const pnls = trades.map((t) => t.pnlPct ?? 0)

  const scores: Record<TradingStyleTag, number> = {
    momentum: 0,
    scalper: 0,
    swing: 0,
    narrative: 0,
    whale_follower: 0,
    mean_reversion: 0,
    breakout: 0,
    liquidity_hunter: 0,
  }

  if (avgHold > 0 && avgHold < 30 * 60_000) scores.scalper += 40
  if (avgHold >= 30 * 60_000 && avgHold < 12 * 3_600_000) scores.momentum += 28
  if (avgHold >= 12 * 3_600_000) scores.swing += 35

  if (avg(vols) > 12) scores.momentum += 18
  if (avg(whale) > 60) scores.whale_follower += 32
  if (avg(mcaps) > 0 && avg(mcaps) < 50_000_000) scores.narrative += 22
  if (
    avg(liqs) > 500_000 &&
    trades.filter((t) => (t.liquidityUsd ?? 0) > 1_000_000).length > trades.length * 0.4
  ) {
    scores.liquidity_hunter += 26
  }

  const bounce = pnls.filter((p) => p > 0).length
  if (bounce > trades.length * 0.25 && avg(vols) > 15) scores.mean_reversion += 20
  if (bounce > trades.length * 0.3 && avg(vols) > 8) scores.breakout += 18

  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1
  return (Object.entries(scores) as [TradingStyleTag, number][])
    .map(([tag, raw]) => ({ tag, weight: Math.round((raw / total) * 100) }))
    .filter((s) => s.weight >= 8)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
}

function riskAppetite(trades: CapturedTrade[]): TraderDna['riskAppetite'] {
  const sizes = trades.map((t) => t.positionSizeUsd)
  const risks = trades.map((t) => t.riskScore ?? 40)
  const avgSize = avg(sizes)
  const avgRisk = avg(risks)
  if (avgRisk >= 70 || avgSize >= 25_000) return 'degen'
  if (avgRisk >= 55 || avgSize >= 8_000) return 'aggressive'
  if (avgRisk <= 35 && avgSize < 2_000) return 'conservative'
  return 'moderate'
}

function favoriteChains(trades: CapturedTrade[]): { chain: ChainId; weight: number }[] {
  const counts = new Map<ChainId, number>()
  for (const t of trades) counts.set(t.chain, (counts.get(t.chain) ?? 0) + 1)
  const total = trades.length || 1
  return Array.from(counts.entries())
    .map(([chain, n]) => ({ chain, weight: Math.round((n / total) * 100) }))
    .sort((a, b) => b.weight - a.weight)
}

function typicalEntry(trades: CapturedTrade[]): EntryExitCondition[] {
  const buys = trades.filter((t) => t.side === 'buy')
  const out: EntryExitCondition[] = []
  if (buys.length === 0) return out
  const avgVol = avg(buys.map((t) => t.volume24hUsd ?? 0))
  const avgWhale = avg(buys.map((t) => t.whaleActivityScore ?? 0))
  const avgLiq = avg(buys.map((t) => t.liquidityUsd ?? 0))
  if (avgWhale >= 55) {
    out.push({
      label: 'Whale accumulation present',
      weight: 0.82,
      evidence: `Avg whale activity ${avgWhale.toFixed(0)}/100 on entries`,
    })
  }
  if (avgVol >= 500_000) {
    out.push({
      label: 'Elevated volume',
      weight: 0.74,
      evidence: `Typical entry volume ~$${Math.round(avgVol).toLocaleString()}`,
    })
  }
  if (avgLiq >= 200_000) {
    out.push({
      label: 'Adequate liquidity',
      weight: 0.7,
      evidence: `Avg liquidity ~$${Math.round(avgLiq).toLocaleString()}`,
    })
  }
  const hours = buys.map((t) => t.hourOfDay)
  if (hours.length) {
    const freq = new Map<number, number>()
    for (const h of hours) freq.set(h, (freq.get(h) ?? 0) + 1)
    const peakHour = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (peakHour != null) {
      out.push({
        label: `Prefers ~${peakHour}:00 UTC entries`,
        weight: 0.55,
        evidence: 'Time-of-day clustering from history',
      })
    }
  }
  return out.slice(0, 4)
}

function typicalExit(trades: CapturedTrade[]): EntryExitCondition[] {
  const closed = trades.filter((t) => t.pnlPct != null)
  const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnlPct ?? 0) < 0)
  const out: EntryExitCondition[] = []
  if (wins.length) {
    out.push({
      label: `Take-profit near +${avg(wins.map((t) => t.pnlPct!)).toFixed(1)}%`,
      weight: 0.8,
      evidence: `${wins.length} winning exits analyzed`,
    })
  }
  if (losses.length) {
    out.push({
      label: `Cut losses near ${avg(losses.map((t) => t.pnlPct!)).toFixed(1)}%`,
      weight: 0.78,
      evidence: `${losses.length} losing exits analyzed`,
    })
  }
  return out
}

function styleSummary(styles: { tag: TradingStyleTag; weight: number }[]): string {
  if (!styles.length) return 'Insufficient history to classify style'
  const labels: Record<TradingStyleTag, string> = {
    momentum: 'Momentum',
    scalper: 'Scalper',
    swing: 'Swing',
    narrative: 'Narrative',
    whale_follower: 'Whale follower',
    mean_reversion: 'Mean reversion',
    breakout: 'Breakout',
    liquidity_hunter: 'Liquidity hunter',
  }
  return styles.map((s) => `${labels[s.tag]} (${s.weight}%)`).join(' · ')
}

function sectors(trades: CapturedTrade[]): string[] {
  const tags = new Set<string>()
  for (const t of trades) {
    const s = t.tokenSymbol.toUpperCase()
    if (/WIF|BONK|PEPE|DEGEN|MEME/.test(s)) tags.add('Memes')
    else if (/SOL|ETH|BNB|BTC/.test(s)) tags.add('Majors')
    else if (/AI|GPT|NEURAL/.test(s)) tags.add('AI')
    else tags.add('Alt / Midcap')
  }
  return Array.from(tags).slice(0, 4)
}

function disciplineScore(trades: CapturedTrade[], winRate: number, stylesLen: number): number {
  const sizes = trades.map((t) => t.positionSizeUsd)
  let sizeCv = 0
  if (sizes.length >= 2) {
    const m = avg(sizes)
    const v = avg(sizes.map((s) => (s - m) ** 2))
    sizeCv = m > 0 ? Math.sqrt(v) / m : 0
  }
  return clamp(48 + winRate * 0.35 - sizeCv * 25 + stylesLen * 3, 5, 99)
}

/**
 * Build Trader DNA from trade history. Marks sample if any input trade is sample.
 */
export function buildTraderDna(wallet: string, trades: CapturedTrade[]): TraderDna {
  const closed = trades.filter((t) => t.pnlPct != null)
  const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnlPct ?? 0) < 0)
  const holds = trades.map((t) => t.holdingDurationMs).filter((h): h is number => h != null)
  const styles = classifyTradingStyles(trades)
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
  const avgRoi = avg(closed.map((t) => t.pnlPct!))
  const lossTol = losses.length ? Math.abs(avg(losses.map((t) => t.pnlPct!))) : 8
  const late = trades.filter((t) => t.hourOfDay >= 22 || t.hourOfDay <= 4)
  const emotional = clamp(20 + late.length * 4 + (lossTol > 20 ? 15 : 0), 5, 95)
  const confidence = clamp(
    trades.length * 4 + winRate * 0.4 + (styles[0]?.weight ?? 0) * 0.25,
    8,
    96,
  )

  return {
    wallet,
    updatedAt: new Date().toISOString(),
    tradeCount: trades.length,
    styles,
    tradingStyleSummary: styleSummary(styles),
    riskAppetite: riskAppetite(trades),
    favoriteSectors: sectors(trades),
    favoriteChains: favoriteChains(trades),
    avgHoldingMs: avg(holds),
    typicalEntry: typicalEntry(trades),
    typicalExit: typicalExit(trades),
    avgRoiPct: Number(avgRoi.toFixed(2)),
    winRatePct: Number(winRate.toFixed(1)),
    lossTolerancePct: Number(lossTol.toFixed(1)),
    disciplineScore: Math.round(disciplineScore(trades, winRate, styles.length)),
    emotionalBiasScore: Math.round(emotional),
    confidenceScore: Math.round(confidence),
    sample: trades.some((t) => t.sample) || undefined,
  }
}

export class TraderDnaEngine {
  private dna: TraderDna | null = null

  constructor(private readonly bus: TlmEventBus) {}

  rebuild(wallet: string, trades: CapturedTrade[]): TraderDna {
    this.dna = buildTraderDna(wallet, trades)
    this.bus.publish(
      'tlm.dna.updated',
      { tradeCount: this.dna.tradeCount, confidence: this.dna.confidenceScore },
      'TraderDnaEngine',
    )
    return this.dna
  }

  getDna() {
    return this.dna
  }
}
