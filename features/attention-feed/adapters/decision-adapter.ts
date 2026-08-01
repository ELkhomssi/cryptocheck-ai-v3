/**
 * Reshape Trade Like Me / Decision Engine output → AttentionItem.
 * Read-only — does not call into engine internals beyond public hooks' state.
 */

import type { ExplainedNarrative } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import type { TradeLikeMeState } from '@/features/terminal-os/ai-trade-like-me/types'
import type { AttentionItem } from '../types'

export function adaptDecisionToAttention(
  state: TradeLikeMeState,
  narrative: ExplainedNarrative | null,
): AttentionItem[] {
  const opp = state.currentOpportunity
  if (!opp) return []

  const action = opp.action
  const conf = Math.round(opp.scores.confidence)
  const symbol = opp.tokenSymbol
  const reality =
    opp.summary ||
    `$${symbol} on ${opp.chain} is the live opportunity your Decision Engine ranked highest (${state.phase}).`
  const analysis =
    narrative?.bullets?.slice(0, 3).join(' ') ||
    opp.reasons.slice(0, 3).join(' · ') ||
    narrative?.confidenceLine ||
    'Explainable AI cited your Trader DNA against current market quality.'

  const urgency =
    conf >= 70 && (action === 'BUY' || action === 'SELL' || action === 'EXIT')
      ? 'now'
      : conf >= 50
        ? 'today'
        : 'fyi'

  return [
    {
      id: `decision:${opp.id}:${action}`,
      sourceEngine: 'decision-engine',
      urgency,
      headline: `${action} $${symbol} — AI conviction ${conf}%`,
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
        { id: 'e-beh', kind: 'score', label: 'Behavior match', value: opp.scores.behaviorMatch },
        { id: 'e-mkt', kind: 'score', label: 'Market quality', value: opp.scores.marketQuality },
        { id: 'e-risk', kind: 'score', label: 'Risk', value: opp.scores.risk },
        { id: 'e-phase', kind: 'text', label: 'Engine phase', value: state.phase },
        ...opp.reasons.slice(0, 4).map((r, i) => ({
          id: `e-reason-${i}`,
          kind: 'text' as const,
          label: 'Reason',
          detail: r,
        })),
        ...opp.citations.slice(0, 3).map((c, i) => ({
          id: `e-cite-${i}`,
          kind: 'text' as const,
          label: `${c.source}.${c.field}`,
          detail: c.contribution,
          value: typeof c.value === 'number' ? c.value : String(c.value),
        })),
      ],
      createdAt: opp.madeAt,
      rankScore: conf + (urgency === 'now' ? 20 : 0),
    },
  ]
}
