/**
 * Scout V2 learning loop — adjusts pillar preference from prior cycle signals.
 * Does not invent GSC metrics; uses internal quality / publish / block signals only
 * until Search Console wiring lands.
 */

import type { EcosystemPillar } from '@/lib/scout/strategy'
import type { ScoutLearningSignal, ScoutTopic } from '@/lib/scout/types'

const PILLAR_IDS: EcosystemPillar[] = [
  'terminal_os',
  'intelligence_chart',
  'ai_gateway',
  'ai_coaching',
  'trade_like_me',
  'portfolio_intelligence',
  'secure_execution',
  'security_scanner',
  'discovery_engine',
  'decision_intelligence',
  'capital_rotation',
  'whale_intelligence',
  'market_psychology',
]

export type PillarWeights = Partial<Record<EcosystemPillar, number>>

/** Derive soft weights from learning signals (−5…+5). */
export function derivePillarWeights(signals: ScoutLearningSignal[]): PillarWeights {
  const weights: PillarWeights = {}
  for (const s of signals.slice(0, 80)) {
    const blob = s.signal.toLowerCase()
    for (const id of PILLAR_IDS) {
      const key = id.replace(/_/g, ' ')
      if (blob.includes(id) || blob.includes(key)) {
        weights[id] = (weights[id] ?? 0) + s.weight
      }
    }
    if (blob.includes('quality_blocked')) {
      // Slightly down-rank whatever was blocked if pillar mentioned
      for (const id of PILLAR_IDS) {
        if (blob.includes(id)) weights[id] = (weights[id] ?? 0) - 0.5
      }
    }
    if (blob.includes('auto_published') || blob.includes('published')) {
      for (const id of PILLAR_IDS) {
        if (blob.includes(id)) weights[id] = (weights[id] ?? 0) + 0.75
      }
    }
  }
  return weights
}

/** Apply learning weights onto topic priority scores (before threshold filter). */
export function applyLearningToTopics(
  topics: ScoutTopic[],
  signals: ScoutLearningSignal[],
): ScoutTopic[] {
  const weights = derivePillarWeights(signals)
  return topics.map((t) => {
    const boost = t.pillar ? (weights[t.pillar] ?? 0) * 2 : 0
    const next = Math.min(100, Math.max(1, (t.priorityScore ?? 50) + boost))
    return { ...t, priorityScore: Math.round(next) }
  })
}

export function nextResearchIso(from = new Date(), hours = 3): string {
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString()
}

export function summarizeLearning(weights: PillarWeights): string {
  const ranked = Object.entries(weights)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
  if (!ranked.length) return 'learning:neutral'
  return `learning:prefer=${ranked.map(([k, v]) => `${k}:${v}`).join(',')}`
}
