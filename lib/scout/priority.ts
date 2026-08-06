/**
 * Scout V2 — topic priority scoring.
 * Only topics above confidence threshold are written/published.
 */

import type { ScoutTopic } from '@/lib/scout/types'
import {
  BANNED_HYPE,
  ECOSYSTEM_PILLARS,
  PRIORITY_CONFIDENCE_THRESHOLD,
  SCOUT_PRIORITY_KEYWORDS,
  type EcosystemPillar,
} from '@/lib/scout/strategy'

export type PriorityBreakdown = {
  topicScore: number
  pillarBoost: number
  keywordBoost: number
  engineBoost: number
  total: number
  passesThreshold: boolean
  matchedPillars: EcosystemPillar[]
}

function textBlob(t: ScoutTopic): string {
  return `${t.title} ${t.narrative} ${t.evidenceLine} ${t.source} ${t.symbol ?? ''} ${t.pillar ?? ''}`.toLowerCase()
}

export function scoreTopicPriority(topic: ScoutTopic): PriorityBreakdown {
  const blob = textBlob(topic)

  if (BANNED_HYPE.test(blob)) {
    return {
      topicScore: 0,
      pillarBoost: 0,
      keywordBoost: 0,
      engineBoost: 0,
      total: 0,
      passesThreshold: false,
      matchedPillars: [],
    }
  }

  const matchedPillars = ECOSYSTEM_PILLARS.filter((p) => {
    if (topic.pillar === p.id) return true
    const hay = blob
    return (
      hay.includes(p.id.replace(/_/g, ' ')) ||
      hay.includes(p.label.toLowerCase()) ||
      p.keywords.some((k) => hay.includes(k.toLowerCase()))
    )
  }).map((p) => p.id)

  const pillarBoost = matchedPillars.reduce((sum, id) => {
    const def = ECOSYSTEM_PILLARS.find((p) => p.id === id)
    return sum + (def?.priorityBoost ?? 8)
  }, 0)
  const cappedPillar = Math.min(36, pillarBoost)

  const keywordHits = SCOUT_PRIORITY_KEYWORDS.filter((k) => blob.includes(k.toLowerCase())).length
  const keywordBoost = Math.min(18, keywordHits * 3)
  const engineBoost = topic.engineCited ? 12 : topic.source === 'manual' ? 0 : 8
  const base = topic.priorityScore != null ? Math.min(40, Math.round(topic.priorityScore * 0.4)) : 22
  const total = Math.min(100, base + cappedPillar + keywordBoost + engineBoost)

  return {
    topicScore: base,
    pillarBoost: cappedPillar,
    keywordBoost,
    engineBoost,
    total,
    passesThreshold: total >= PRIORITY_CONFIDENCE_THRESHOLD,
    matchedPillars,
  }
}

export function filterPublishableTopics(topics: ScoutTopic[]): ScoutTopic[] {
  return topics
    .map((t) => {
      const priority = scoreTopicPriority(t)
      return {
        ...t,
        priorityScore: priority.total,
        pillar: t.pillar ?? priority.matchedPillars[0],
      }
    })
    .filter((t) => (t.priorityScore ?? 0) >= PRIORITY_CONFIDENCE_THRESHOLD)
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
}
