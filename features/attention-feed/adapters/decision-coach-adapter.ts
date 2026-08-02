/**
 * Map server Decisions → proactive Coach AttentionItems.
 * Evidence must trace to contributingFactors — no generic coach copy.
 */

import type { Decision } from '@cryptocheck/decision-contracts'
import type { AttentionItem } from '../types'

function confOf(d: Decision): number {
  if (d.confidenceMode === 'personalized' && d.personalizedConfidence != null) {
    return Math.round(d.personalizedConfidence)
  }
  return Math.round(d.marketConfidence ?? d.confidence)
}

function modeLabel(d: Decision): string {
  return d.confidenceMode === 'market'
    ? 'Market-quality insight (no Trader DNA)'
    : 'Personalized · Trader DNA'
}

/**
 * Decision → CoachInsight-shaped AttentionItem (sourceEngine: ai-coach).
 * Id embeds action + confidence so fingerprinting treats changes as new messages.
 */
export function adaptDecisionCoachToAttention(decisions: Decision[]): AttentionItem[] {
  return decisions
    .filter(
      (d) =>
        d.action === 'BUY' ||
        d.action === 'SELL' ||
        d.action === 'EXIT' ||
        d.action === 'WAIT',
    )
    .slice(0, 4)
    .map((d) => {
      const conf = confOf(d)
      const symbol =
        d.subject.kind === 'token' ? d.subject.symbol : d.subject.address.slice(0, 6)
      const label = modeLabel(d)
      const urgency =
        conf >= 70 && (d.action === 'BUY' || d.action === 'SELL' || d.action === 'EXIT')
          ? 'now'
          : conf >= 50
            ? 'today'
            : 'fyi'
      const factors = d.contributingFactors.slice(0, 5)
      return {
        // Include action+confidence so DecisionMade changes surface as new coach messages
        id: `coach:decision:${d.id}:${d.action}:${conf}`,
        sourceEngine: 'ai-coach' as const,
        urgency,
        headline: `${d.action} $${symbol} · ${label}`,
        reality: label,
        analysis: d.reasoning.slice(0, 320),
        recommendation: {
          action:
            d.action === 'DO_NOTHING' || d.action === 'WAIT'
              ? `Hold / wait on $${symbol}`
              : `${d.action} $${symbol}`,
          confidence: conf,
        },
        evidence: [
          {
            id: 'e-mode',
            kind: 'text' as const,
            label: 'Insight mode',
            value: label,
          },
          {
            id: 'e-conf',
            kind: 'score' as const,
            label:
              d.confidenceMode === 'personalized'
                ? 'Personalized confidence'
                : 'Market confidence',
            value: conf,
          },
          ...factors.map((f, i) => ({
            id: `e-factor-${i}-${f.engine}`,
            kind: 'text' as const,
            label: String(f.engine),
            detail: f.summary,
            value: Math.round(f.weight * 100),
          })),
        ],
        createdAt: d.computedAt,
        rankScore: conf + (urgency === 'now' ? 18 : 0) - 2, // sit near decision-engine items
      } satisfies AttentionItem
    })
}
