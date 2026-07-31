/**
 * Reshape coach + portfolio provider output → AttentionItem.
 * Uses the same providers Pro Mode already mounts — reshape only.
 */

import type { CoachInsight, PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import type { AttentionItem } from '../types'

export function adaptCoachToAttention(insights: CoachInsight[]): AttentionItem[] {
  return insights.slice(0, 3).map((c) => ({
    id: `coach:${c.id}`,
    sourceEngine: 'ai-coach' as const,
    urgency: c.confidence >= 75 ? 'today' : 'fyi',
    headline: c.headline,
    reality: c.statistic,
    analysis: c.reasoning,
    recommendation: {
      action: c.expectedImpact,
      confidence: Math.round(c.confidence),
    },
    evidence: [
      { id: 'e-conf', kind: 'score', label: 'Coach confidence', value: Math.round(c.confidence) },
      { id: 'e-stat', kind: 'text', label: 'Statistic', detail: c.statistic },
    ],
    createdAt: new Date().toISOString(),
    rankScore: Math.round(c.confidence),
  }))
}

export function adaptPortfolioToAttention(summary: PortfolioHealthSummary): AttentionItem[] {
  const urgency = summary.aiHealthScore < 55 ? 'now' : summary.aiHealthScore < 70 ? 'today' : 'fyi'
  return [
    {
      id: 'portfolio:health',
      sourceEngine: 'portfolio-intelligence',
      urgency,
      headline:
        summary.aiHealthScore < 55
          ? `Portfolio health needs attention (${summary.aiHealthScore}/100)`
          : `Portfolio health ${summary.aiHealthScore}/100 — ${summary.pnl24hPct >= 0 ? 'stable' : 'soft'}`,
      reality: `Book ~$${Math.round(summary.totalAssetsUsd).toLocaleString()} · 24h PnL ${summary.pnl24hPct >= 0 ? '+' : ''}${summary.pnl24hPct.toFixed(2)}% ($${Math.round(summary.pnl24hUsd).toLocaleString()}).`,
      analysis: summary.healthWhy || summary.stabilityWhy || 'Portfolio Intelligence summarized your book.',
      recommendation: {
        action: summary.aiHealthScore < 55 ? 'Review concentration and risk before new entries' : 'Maintain plan — no urgent rebalance signal',
        confidence: Math.round(summary.aiHealthScore),
      },
      evidence: [
        { id: 'e-health', kind: 'score', label: 'AI health', value: summary.aiHealthScore },
        { id: 'e-stab', kind: 'score', label: 'Stability', value: summary.stabilityScore },
        { id: 'e-div', kind: 'score', label: 'Diversification', value: summary.diversificationScore },
        { id: 'e-why', kind: 'text', label: 'Stability note', detail: summary.stabilityWhy },
      ],
      createdAt: new Date().toISOString(),
      rankScore: 100 - summary.aiHealthScore + (urgency === 'now' ? 25 : 0),
    },
  ]
}
