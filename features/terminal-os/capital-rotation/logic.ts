/**
 * Pure capital-rotation logic — no Redis / server-only.
 */

import type { MarketContext } from '@/features/terminal-os/ai-trade-like-me/types'
import type { RotationAggregateStats, RotationEvent } from './types'

export type DeteriorationVerdict = {
  genuine: boolean
  reasons: string[]
  noiseOnly: boolean
}

/**
 * Distinguish genuine deterioration from ordinary short-term volatility.
 * Bare price-drop alone is never enough.
 */
export function assessDeterioration(
  intel: MarketContext,
  pnlPctFromEntry: number,
  thresholdPct: number,
): DeteriorationVerdict {
  const reasons: string[] = []
  let signalScore = 0

  if (intel.whaleBias === 'distributing') {
    reasons.push('whale distribution detected')
    signalScore += 2
  }
  if (intel.liquidityTrend === 'decreasing') {
    reasons.push('liquidity decreasing')
    signalScore += 2
  }
  if (intel.securityBand === 'danger' || intel.securityBand === 'caution') {
    reasons.push(`security band ${intel.securityBand}`)
    signalScore += intel.securityBand === 'danger' ? 3 : 1
  }
  if (intel.riskScore >= 65) {
    reasons.push(`elevated riskScore ${Math.round(intel.riskScore)}`)
    signalScore += 2
  }
  if (intel.orderFlowBias === 'sell') {
    reasons.push('order flow biased sell')
    signalScore += 1
  }
  if (intel.smartMoneyScore < 40) {
    reasons.push('smart-money score weak')
    signalScore += 1
  }
  if (pnlPctFromEntry <= -thresholdPct) {
    reasons.push(`down ${pnlPctFromEntry.toFixed(1)}% from entry (threshold −${thresholdPct}%)`)
  }

  const breached = pnlPctFromEntry <= -thresholdPct
  const genuine = breached && signalScore >= 2
  const noiseOnly = breached && signalScore < 2

  if (noiseOnly) {
    reasons.push('price dip without confirming MarketContext signals — treating as ordinary volatility')
  }

  return { genuine, reasons, noiseOnly }
}

export function computeRotationAggregate(events: RotationEvent[]): RotationAggregateStats {
  if (!events.length) {
    return {
      eventCount: 0,
      avgExitResultPct: null,
      lossExitCount: 0,
      measuredEntryCount: 0,
      avgEntryResultPct: null,
      aggregateNetPct: null,
      honestyNote:
        'No rotation events yet. Individual exits may still be losses — the goal is smaller, faster losses and capital reuse, not zero losses.',
    }
  }
  const exits = events.map((e) => e.exitResultPct)
  const avgExit = exits.reduce((a, b) => a + b, 0) / exits.length
  const lossExitCount = exits.filter((n) => n < 0).length
  const measured = events.filter((e) => e.entryResultPct != null)
  const avgEntry =
    measured.length > 0
      ? measured.reduce((a, e) => a + (e.entryResultPct as number), 0) / measured.length
      : null
  const pairs = measured.map((e) => e.exitResultPct + (e.entryResultPct as number))
  const aggregateNet =
    pairs.length >= 3 ? pairs.reduce((a, b) => a + b, 0) / pairs.length : null

  return {
    eventCount: events.length,
    avgExitResultPct: Number(avgExit.toFixed(2)),
    lossExitCount,
    measuredEntryCount: measured.length,
    avgEntryResultPct: avgEntry != null ? Number(avgEntry.toFixed(2)) : null,
    aggregateNetPct: aggregateNet != null ? Number(aggregateNet.toFixed(2)) : null,
    honestyNote:
      'Aggregate rotation performance includes real exit losses. Proof of value is whether the strategy beats holding through drawdowns over many events — not that every leg wins.',
  }
}
