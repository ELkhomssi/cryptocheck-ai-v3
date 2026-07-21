/**
 * Weekly intelligence digest for Coach column.
 * Prefer real weekly-brief.ts fields; narrative research fields stay null until a desk feed exists.
 * MOCK_ONLY narratives only when NEXT_PUBLIC_TERMINAL_MOCK_WEEKLY=1.
 */

import { buildWeeklyBrief, type WeeklyBriefPayload } from './weekly-brief'
import { mockWeeklyNarratives } from './mocks/weekly-intel.mock'

export type WeeklyIntel = {
  weekOf: string
  topNarrative: string | null
  smartMoneyRotation: string | null
  convictionSector: string | null
  biggestRisk: string | null
  summary: string | null
  personalLines: string[]
  briefNumber: number
  /** True when narrative fields came from MOCK_ONLY adapter. */
  mockNarratives: boolean
}

export function loadWeeklyIntel(now = new Date()): WeeklyIntel {
  const brief: WeeklyBriefPayload = buildWeeklyBrief(now)
  const personal = brief.sections.find((s) => s.id === 'personal')
  const personalLines = personal?.lines ?? []

  const useMock =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TERMINAL_MOCK_WEEKLY === '1'

  if (useMock) {
    const m = mockWeeklyNarratives()
    return {
      weekOf: brief.weekStartIso.slice(0, 10),
      topNarrative: m.topNarrative,
      smartMoneyRotation: m.smartMoneyRotation,
      convictionSector: m.convictionSector,
      biggestRisk: m.biggestRisk,
      summary: m.summary,
      personalLines,
      briefNumber: brief.briefNumber,
      mockNarratives: true,
    }
  }

  return {
    weekOf: brief.weekStartIso.slice(0, 10),
    topNarrative: null,
    smartMoneyRotation: null,
    convictionSector: null,
    biggestRisk: null,
    summary: personalLines[0] ?? null,
    personalLines,
    briefNumber: brief.briefNumber,
    mockNarratives: false,
  }
}
