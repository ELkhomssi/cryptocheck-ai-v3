/**
 * Replay / scrubber — resolve sidebar state at an arbitrary timestamp.
 * Interpolates from sparse sidebarTimeline samples (never fabricates metrics).
 */

import type { IntelligenceSidebarState } from '../types'

export function getStateAtTimestamp(
  timeline: IntelligenceSidebarState[],
  ts: number,
): IntelligenceSidebarState | null {
  if (!timeline.length) return null
  const sorted = [...timeline].sort((a, b) => a.timestamp - b.timestamp)
  if (ts <= sorted[0]!.timestamp) return sorted[0]!
  if (ts >= sorted[sorted.length - 1]!.timestamp) return sorted[sorted.length - 1]!

  let lo = sorted[0]!
  let hi = sorted[sorted.length - 1]!
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i]!.timestamp <= ts && sorted[i + 1]!.timestamp >= ts) {
      lo = sorted[i]!
      hi = sorted[i + 1]!
      break
    }
  }
  if (lo.timestamp === hi.timestamp) return lo
  // Prefer the latest sample at or before ts — do not invent mid-point metrics
  return lo
}
