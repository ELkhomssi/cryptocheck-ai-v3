'use client'

import { useState } from 'react'
import { VerdictCard } from './VerdictCard'
import { CoachTrackRecord } from './CoachTrackRecord'
import { WeeklyBriefPanel } from './WeeklyBriefPanel'
import { BehaviorCoachPanel } from './BehaviorCoachPanel'
import { TradeOutcomesPanel } from './TradeOutcomesPanel'
import { useTerminalFocus } from './TerminalFocusProvider'

export type CoachRailTab = 'verdict' | 'record' | 'brief' | 'behavior' | 'outcomes'

type Props = {
  tab: CoachRailTab
  onTab: (t: CoachRailTab) => void
}

export function CoachRail({ tab, onTab }: Props) {
  const { coachCollapsed } = useTerminalFocus()

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      {!coachCollapsed ? (
        <div className="flex gap-0.5 overflow-x-auto px-0.5" role="tablist" aria-label="Coach panels">
          {(
            [
              ['verdict', 'Verdict', 'V'],
              ['record', 'Record', 'T'],
              ['outcomes', 'Marks', 'M'],
              ['behavior', 'Behav', 'H'],
              ['brief', 'Brief', 'R'],
            ] as const
          ).map(([id, label, key]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
              className={`tit-mono shrink-0 rounded px-1.5 py-1 text-[0.55rem] ${
                tab === id
                  ? 'bg-[var(--tit-ember)] text-white'
                  : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-1)]'
              }`}
            >
              {label} ({key})
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {tab === 'verdict' ? <VerdictCard /> : null}
        {tab === 'record' ? <CoachTrackRecord /> : null}
        {tab === 'outcomes' ? <TradeOutcomesPanel /> : null}
        {tab === 'behavior' ? <BehaviorCoachPanel /> : null}
        {tab === 'brief' ? <WeeklyBriefPanel /> : null}
      </div>
    </div>
  )
}

export function useCoachRailTab() {
  return useState<CoachRailTab>('verdict')
}
