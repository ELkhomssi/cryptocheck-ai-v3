/**
 * Pure merge of AttentionItems + live events → feed entries.
 * Batching / FLIP live in the hook + list; this only labels new vs updated.
 */

import type { AttentionFeedEntry, AttentionItem, AttentionLiveKind } from '../types'

export type LiveEventHint = {
  itemId: string
  kind: 'new' | 'updated'
  at: string
}

export function mergeLiveEntries(
  items: AttentionItem[],
  hints: LiveEventHint[],
  lastSeenAt: number,
  prevKinds: Record<string, AttentionLiveKind>,
): AttentionFeedEntry[] {
  const hintMap = new Map(hints.map((h) => [h.itemId, h]))
  return items.map((item) => {
    const hint = hintMap.get(item.id)
    let kind: AttentionLiveKind = prevKinds[item.id] ?? 'stable'
    if (hint?.kind === 'new') kind = 'new'
    else if (hint?.kind === 'updated') kind = 'updated'

    const createdMs = new Date(item.createdAt).getTime()
    const hintMs = hint ? new Date(hint.at).getTime() : 0
    const sinceAway =
      lastSeenAt > 0 &&
      ((Number.isFinite(createdMs) && createdMs > lastSeenAt) ||
        (Number.isFinite(hintMs) && hintMs > lastSeenAt) ||
        kind === 'new' ||
        kind === 'updated')

    return { item, kind, sinceAway: Boolean(sinceAway && lastSeenAt > 0) }
  })
}
