/** Four-state feed UI machine for dashboard surfaces. */
export type FeedLoadState = 'loading' | 'error' | 'empty' | 'data'

export const FEED_LOAD_TIMEOUT_MS = 8_000

export function feedStateHasData(state: FeedLoadState): boolean {
  return state === 'data'
}

export function feedStateShowSkeleton(state: FeedLoadState): boolean {
  return state === 'loading'
}
