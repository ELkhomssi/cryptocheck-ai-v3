/**
 * Map ExplainableDecision → canonical Decision (Layer 3).
 * Adapter only — does not change Decision Engine scoring.
 */

import type { Decision, DecisionAction, EngineId } from '@cryptocheck/decision-contracts'
import type { ExplainableDecision, ScoreCitation } from '../types'

const STALE_MS = 5 * 60_000

function citationEngine(c: ScoreCitation): string {
  if (c.source === 'TraderDNA') return 'trader-dna'
  if (c.source === 'MarketContext') return 'market-intelligence'
  if (c.source === 'Collective') return 'collective-intelligence'
  return 'prediction-engine'
}

export function toCanonicalDecision(
  d: ExplainableDecision,
  opts?: {
    degraded?: boolean
    degradedInputs?: EngineId[]
    tokenAddress?: string
    personalized?: boolean
  },
): Decision {
  const degradedInputs = [...new Set(opts?.degradedInputs ?? [])]
  const degraded = Boolean(opts?.degraded || degradedInputs.length)
  const factors = d.citations.slice(0, 8).map((c) => ({
    engine: citationEngine(c),
    summary: c.contribution,
    weight: typeof c.value === 'number' ? Math.min(1, Math.max(0, Number(c.value) / 100)) : 0.2,
  }))
  if (factors.length < 2) {
    for (const r of d.reasons.slice(0, 3)) {
      factors.push({ engine: 'market-intelligence', summary: r, weight: 0.25 })
    }
  }

  const computedAt = d.madeAt
  const staleAfter = new Date(new Date(computedAt).getTime() + STALE_MS).toISOString()
  // Market-quality vs DNA split (PR #79 calibration) — derived from existing scores, not invented
  const marketConfidence = Math.round(d.scores.marketQuality)
  const personalized =
    opts?.personalized && Number.isFinite(d.scores.behaviorMatch)
      ? Math.round(d.scores.behaviorMatch)
      : undefined
  const confidenceMode = personalized != null ? 'personalized' : 'market'
  const confidence = personalized != null ? personalized : marketConfidence

  return {
    id: d.id,
    subject: {
      kind: 'token',
      symbol: d.tokenSymbol,
      address: opts?.tokenAddress,
      chain: d.chain,
    },
    action: d.action as DecisionAction,
    confidence,
    marketConfidence,
    personalizedConfidence: personalized,
    confidenceMode,
    reasoning: [d.summary, ...d.reasons.slice(0, 3)].filter(Boolean).join(' · '),
    contributingFactors: factors,
    risk: Math.round(d.scores.risk),
    expectedROI: d.scores.expectedRoiPct ?? d.estimatedUpsidePct,
    expectedDrawdown: d.scores.expectedDrawdownPct ?? d.estimatedDownsidePct,
    degraded,
    degradedInputs: degradedInputs.length ? degradedInputs : undefined,
    computedAt,
    staleAfter,
  }
}
