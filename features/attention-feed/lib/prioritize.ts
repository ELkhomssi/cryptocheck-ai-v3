/**
 * Attention Feed prioritization — urgency × confidence × relevance.
 * No business rules beyond ranking; adapters supply rankScore seeds.
 */

import type { AttentionItem, AttentionUrgency } from '../types'

const URGENCY_WEIGHT: Record<AttentionUrgency, number> = {
  now: 3,
  today: 2,
  fyi: 1,
}

export function prioritizeAttentionItems(items: AttentionItem[], limit = 7): AttentionItem[] {
  return [...items]
    .sort((a, b) => {
      const ua = URGENCY_WEIGHT[a.urgency] * 1000 + a.rankScore
      const ub = URGENCY_WEIGHT[b.urgency] * 1000 + b.rankScore
      if (ub !== ua) return ub - ua
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, limit)
}
