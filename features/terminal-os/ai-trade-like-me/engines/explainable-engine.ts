/**
 * Explainable AI Engine V2 — cites specific TraderDNA / OpportunityScore fields.
 * Vague or uncited reasoning is a shipped bug.
 */

import type { ExplainableDecision, ScoreCitation } from '../types'

export interface ExplainedNarrative {
  headline: string
  confidenceLine: string
  bullets: string[]
  disagreementBlock: string | null
  disagreementRequiresAck: boolean
  upsideLine: string
  downsideLine: string
  citations: ScoreCitation[]
  footer: string
}

export function explainDecision(d: ExplainableDecision): ExplainedNarrative {
  const bullets = [
    ...d.reasons,
    `behaviorMatch ${d.scores.behaviorMatch}% · marketQuality ${d.scores.marketQuality}%`,
    `probability ${d.scores.probability}% · timing ${d.scores.timing}% · executionQuality ${d.scores.executionQuality}%`,
  ]

  // Ensure every explanation has at least one citation
  const citations =
    d.citations.length > 0
      ? d.citations
      : [
          {
            source: 'Weights' as const,
            field: 'scores.confidence',
            value: d.scores.confidence,
            contribution: 'fallback — missing citations is a bug',
          },
        ]

  return {
    headline: d.action,
    confidenceLine: `Confidence ${d.scores.confidence}%`,
    bullets,
    disagreementBlock: d.disagreement?.overrideReason ?? null,
    disagreementRequiresAck: Boolean(d.disagreement?.requiresExplicitUserAck),
    upsideLine: `Estimated upside +${d.estimatedUpsidePct}%`,
    downsideLine: `Expected drawdown −${d.estimatedDownsidePct}%`,
    citations,
    footer:
      'Not financial advice · DYOR · CryptoCheck AI improves your edge — it does not copy trades.',
  }
}

export class ExplainableAiEngine {
  explain(decision: ExplainableDecision) {
    return explainDecision(decision)
  }
}
