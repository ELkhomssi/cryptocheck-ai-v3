/**
 * MOCK_ONLY — do not ship as real feed.
 * Research-style narrative fields for Weekly Intelligence when no desk feed exists.
 */

export const MOCK_ONLY = true as const

export function mockWeeklyNarratives() {
  return {
    topNarrative: 'AI Agents',
    smartMoneyRotation: 'Into LaunchLab tokens',
    convictionSector: 'Infrastructure',
    biggestRisk: 'Liquidity fragmentation',
    summary: 'Risk appetite increasing.',
  }
}
