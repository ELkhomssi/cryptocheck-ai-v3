/**
 * Reshape Trade Like Me / Decision Engine output → AttentionItem.
 * Read-only consumer of canonical Decision (Layer 4).
 */

import type { ExplainedNarrative } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import type { TradeLikeMeState } from '@/features/terminal-os/ai-trade-like-me/types'
import { toCanonicalDecision } from '@/features/terminal-os/ai-trade-like-me/lib/to-canonical-decision'
import type { AttentionItem } from '../types'

export function adaptDecisionToAttention(
  state: TradeLikeMeState,
  narrative: ExplainedNarrative | null,
): AttentionItem[] {
  const opp = state.currentOpportunity
  if (!opp && !state.canonicalDecision) return []

  const decision = state.canonicalDecision ?? (opp ? toCanonicalDecision(opp) : null)
  if (!decision) return []
  const action = decision.action
  const conf = decision.confidence
  const symbol = decision.subject.kind === 'token' ? decision.subject.symbol : opp.tokenSymbol
  const reality = decision.reasoning
  const analysis =
    narrative?.bullets?.slice(0, 3).join(' ') ||
    decision.contributingFactors
      .slice(0, 3)
      .map((f) => f.summary)
      .join(' · ') ||
    narrative?.confidenceLine ||
    'Canonical Decision — Explainable AI tone only.'

  const urgency =
    conf >= 70 && (action === 'BUY' || action === 'SELL' || action === 'EXIT')
      ? 'now'
      : conf >= 50
        ? 'today'
        : 'fyi'

  return [
    {
      id: `decision:${decision.id}:${action}`,
      sourceEngine: 'decision-engine',
      urgency,
      headline: `${action} $${symbol} — Decision confidence ${conf}%${decision.degraded ? ' · degraded' : ''}`,
      reality,
      analysis,
      recommendation: {
        action:
          action === 'DO_NOTHING' || action === 'WAIT'
            ? `Hold / wait on $${symbol}`
            : `${action} $${symbol}`,
        confidence: conf,
      },
      evidence: [
        { id: 'e-conf', kind: 'score', label: 'Confidence', value: conf },
        { id: 'e-risk', kind: 'score', label: 'Risk', value: decision.risk },
        { id: 'e-phase', kind: 'text', label: 'Engine phase', value: state.phase },
        ...(decision.degradedInputs ?? []).map((e, i) => ({
          id: `e-deg-${i}`,
          kind: 'text' as const,
          label: 'Degraded input',
          detail: e,
        })),
        ...decision.contributingFactors.slice(0, 4).map((f, i) => ({
          id: `e-factor-${i}`,
          kind: 'text' as const,
          label: String(f.engine),
          detail: f.summary,
          value: f.weight,
        })),
      ],
      createdAt: decision.computedAt,
      rankScore: conf + (urgency === 'now' ? 20 : 0),
    },
  ]
}
