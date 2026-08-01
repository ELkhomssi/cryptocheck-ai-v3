/**
 * Last-session marker for "since you've been away".
 * Simple Mode only — never touches Pro stores.
 */

const KEY = 'ccai:tos:attention:last-seen'

export function readLastSeenAt(): number {
  if (typeof window === 'undefined') return 0
  try {
    const v = window.localStorage.getItem(KEY)
    const n = v ? Number(v) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** Call when the user has viewed the feed this session (debounced by caller). */
export function writeLastSeenAt(at = Date.now()) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, String(at))
  } catch {
    /* ignore */
  }
}
