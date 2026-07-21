/**
 * MOCK_ONLY — do not ship as real feed.
 * Opt-in similar-setups sample for local UI work only.
 * Production must use loadSimilarSetups() → insufficient.
 */

export const MOCK_ONLY = true as const

import type { SimilarSetupsReady } from '../similar-setups'

/** Only call when NEXT_PUBLIC_TERMINAL_MOCK_SIMILAR=1 */
export function mockSimilarSetups(): SimilarSetupsReady {
  return {
    insufficient: false,
    count: 12,
    avgOutcomePct: 18.4,
    winRatePct: 61,
    avgHoldDays: 4.2,
  }
}
