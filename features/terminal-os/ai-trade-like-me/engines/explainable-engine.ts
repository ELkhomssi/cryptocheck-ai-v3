/**
 * Explainable AI Engine — formats decisions into human-readable narratives.
 * Every recommendation must explain itself. No black boxes.
 */

import type { ExplainableDecision } from '../types'

export interface ExplainedNarrative {
  headline: string
  confidenceLine: string
  bullets: string[]
  disagreementBlock: string | null
  upsideLine: string
  downsideLine: string
  footer: string
}

export function explainDecision(d: ExplainableDecision): ExplainedNarrative {
  const bullets = [
    ...d.reasons,
    `Behavior match ${d.scores.behaviorMatch}%`,
    `Market quality ${d.scores.marketQuality}%`,
    `Probability ${d.scores.probability}% · Timing ${d.scores.timing}%`,
  ]
  return {
    headline: d.action,
    confidenceLine: `Confidence ${d.scores.confidence}%`,
    bullets,
    disagreementBlock: d.disagreements.length
      ? d.disagreements.join('\n')
      : null,
    upsideLine: `Estimated upside +${d.estimatedUpsidePct}%`,
    downsideLine: `Expected drawdown −${d.estimatedDownsidePct}%`,
    footer: 'Not financial advice · DYOR · CryptoCheck AI improves your edge — it does not copy trades.',
  }
}

export class ExplainableAiEngine {
  explain(decision: ExplainableDecision) {
    return explainDecision(decision)
  }
}
