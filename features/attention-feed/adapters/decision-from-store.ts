/**
 * Reshape server-persisted canonical Decisions → AttentionItem.
 * Layer 4 only — no Decision Engine import.
 */

import type { Decision } from '@cryptocheck/decision-contracts'
import type { AttentionItem } from '../types'

export function adaptCanonicalDecisionToAttention(decisions: Decision[]): AttentionItem[] {
  return decisions
    .filter((d) => d.action === 'BUY' || d.action === 'SELL' || d.action === 'EXIT' || d.action === 'WAIT')
    .slice(0, 6)
    .map((d) => {
      const conf = d.marketConfidence ?? d.confidence
      const symbol = d.subject.kind === 'token' ? d.subject.symbol : d.subject.address.slice(0, 6)
      const urgency =
        conf >= 70 && (d.action === 'BUY' || d.action === 'SELL' || d.action === 'EXIT')
          ? 'now'
          : conf >= 50
            ? 'today'
            : 'fyi'
      return {
        id: `decision:${d.id}`,
        sourceEngine: 'decision-engine' as const,
        urgency,
        headline: `${d.action} $${symbol} — ${d.confidenceMode} conf ${conf}%${d.degraded ? ' · degraded' : ''}`,
        reality: d.reasoning,
        analysis: d.contributingFactors
          .slice(0, 3)
          .map((f) => f.summary)
          .join(' · '),
        recommendation: {
          action:
            d.action === 'DO_NOTHING' || d.action === 'WAIT'
              ? `Hold / wait on $${symbol}`
              : `${d.action} $${symbol}`,
          confidence: conf,
        },
        evidence: [
          { id: 'e-conf', kind: 'score', label: 'Market confidence', value: d.marketConfidence },
          { id: 'e-mode', kind: 'text', label: 'Mode', value: d.confidenceMode },
          { id: 'e-risk', kind: 'score', label: 'Risk', value: d.risk },
        ],
        createdAt: d.computedAt,
        rankScore: conf + (urgency === 'now' ? 20 : 0),
      } satisfies AttentionItem
    })
}
