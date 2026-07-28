/**
 * Performance Analytics Engine — compares AI-improved decisions vs raw trader habits.
 */

import type { CapturedTrade, PerformanceReport, TraderDna } from '../types'
import type { TlmEventBus } from './event-bus'

export function buildPerformanceReport(
  trades: CapturedTrade[],
  dna: TraderDna | null,
): PerformanceReport {
  const closed = trades.filter((t) => t.pnlPct != null)
  const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0)
  const traderWr = closed.length ? (wins.length / closed.length) * 100 : 0
  // Modelled AI win-rate: discipline + confidence uplift (not fabricated P&L dollars)
  const aiWr = dna
    ? Math.min(94, traderWr + dna.disciplineScore * 0.08 + (100 - dna.emotionalBiasScore) * 0.05)
    : traderWr
  return {
    periodLabel: 'Learning window',
    tradesAnalyzed: trades.length,
    aiWinRatePct: Number(aiWr.toFixed(1)),
    traderWinRatePct: Number(traderWr.toFixed(1)),
    alphaVsSelfPct: Number((aiWr - traderWr).toFixed(1)),
    avgHoldImprovementMs: 0,
    notes: [
      'Alpha-vs-self is a model estimate from discipline / bias scores — not live PnL attribution.',
      'Autonomy remains advise-only until feature flags enable execution.',
    ],
    sample: trades.some((t) => t.sample) || undefined,
  }
}

export class PerformanceAnalyticsEngine {
  constructor(private readonly bus: TlmEventBus) {}

  report(trades: CapturedTrade[], dna: TraderDna | null): PerformanceReport {
    const report = buildPerformanceReport(trades, dna)
    this.bus.publish(
      'tlm.analytics.updated',
      { trades: report.tradesAnalyzed, alpha: report.alphaVsSelfPct },
      'PerformanceAnalyticsEngine',
    )
    return report
  }
}
