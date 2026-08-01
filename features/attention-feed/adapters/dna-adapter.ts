/**
 * Reshape Trader DNA → AttentionItem for "Understand me" / Coach workspace.
 */

import type { TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'
import type { AttentionItem } from '../types'

export function adaptDnaToAttention(dna: TraderDna | null): AttentionItem[] {
  if (!dna || dna.sampleSize < 1 || dna.sample) return []
  return [
    {
      id: `dna:${dna.wallet}:${dna.updatedAt}`,
      sourceEngine: 'ai-coach',
      urgency: dna.confidence >= 60 ? 'today' : 'fyi',
      headline: `I understand your style as ${dna.tradingStyleSummary}`,
      reality: `Risk appetite ${dna.riskAppetiteLabel} · sample size ${dna.sampleSize} trades/signals.`,
      analysis: `Confidence ${Math.round(dna.confidence)}% from your real history — leaving means restarting this learning.`,
      recommendation: {
        action: 'Keep training — Pause & Teach when a call disagrees with you',
        confidence: Math.round(dna.confidence),
      },
      evidence: [
        { id: 'e-conf', kind: 'score', label: 'DNA confidence', value: Math.round(dna.confidence) },
        { id: 'e-sample', kind: 'metric', label: 'Sample size', value: dna.sampleSize },
        { id: 'e-risk', kind: 'text', label: 'Risk', value: dna.riskAppetiteLabel },
        { id: 'e-win', kind: 'metric', label: 'Win rate %', value: Math.round(dna.winRatePct) },
      ],
      createdAt: dna.updatedAt,
      rankScore: Math.round(dna.confidence),
    },
  ]
}
