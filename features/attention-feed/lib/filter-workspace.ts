/**
 * Filter Attention Feed items for Simple Mode workspaces — no re-ranking math.
 */

import type { AttentionItem } from '../types'
import { WORKSPACE_ENGINES, type SimpleWorkspaceId } from './vocab'

const HIGH_CONVICTION_MIN = 70

export function filterWorkspaceItems(
  items: AttentionItem[],
  workspace: SimpleWorkspaceId,
): AttentionItem[] {
  if (workspace === 'home') return items

  if (workspace === 'execution') {
    return items.filter(
      (i) =>
        i.sourceEngine === 'decision-engine' &&
        Boolean(i.recommendation) &&
        (i.recommendation?.confidence ?? 0) >= 50,
    )
  }

  if (workspace === 'discovery') {
    const engines = WORKSPACE_ENGINES.discovery
    return items.filter(
      (i) =>
        engines.includes(i.sourceEngine) &&
        (i.recommendation?.confidence ?? i.rankScore) >= HIGH_CONVICTION_MIN,
    )
  }

  const engines = WORKSPACE_ENGINES[workspace]
  return items.filter((i) => engines.includes(i.sourceEngine))
}
