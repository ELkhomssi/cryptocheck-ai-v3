'use client'

/**
 * Mission Control — conversation with the OS.
 * Not a dashboard. Speaks first from real MissionEngine data, then listens.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { MissionCommandCenter } from '@/components/portfolio-desk/mission/MissionCommandCenter'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import { buildMissionConversation } from '@/lib/portfolio-desk/mission-narrative'
import type { MissionViewModel } from '@/types/intelligence-core'
import type { ScreenerRow } from '@/lib/providers/types'

export function MissionControlPanel({
  onOpenFeed,
  onOpenMarket: _onOpenMarket,
  onSelectToken: _onSelectToken,
  onSuggestion: _onSuggestion,
}: {
  onOpenFeed: () => void
  onOpenMarket: () => void
  onSelectToken: (row: ScreenerRow) => void
  onSuggestion: (text: string) => void
  showObservationsInline?: boolean
}) {
  const { walletAddress, shortAddr, isConnected } = useSolana()
  const [seed, setSeed] = useState<string | null>(null)

  const missionQ = useQuery({
    queryKey: ['intelligence-core-mission', walletAddress],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/intelligence-core/mission${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Mission view unavailable')
      return (await res.json()) as MissionViewModel
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
  })

  const conversation = useMemo(
    () =>
      buildMissionConversation({
        displayName: isConnected && shortAddr ? shortAddr : null,
        view: missionQ.data ?? null,
        loading: missionQ.isLoading,
      }),
    [isConnected, shortAddr, missionQ.data, missionQ.isLoading],
  )

  return (
    <div className="mc-talk">
      <div className="mc-talk-thread" aria-live="polite">
        {conversation.turns.map((turn) => {
          if (turn.kind === 'ask') {
            return (
              <p key={turn.id} className="mc-talk-ask">
                {turn.text}
              </p>
            )
          }
          if (turn.kind === 'live') {
            return (
              <div key={turn.id} className="mc-talk-live">
                {turn.text.split('\n').map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )
          }
          if (turn.kind === 'aside') {
            return (
              <p key={turn.id} className="mc-talk-aside">
                {turn.text}
              </p>
            )
          }
          return (
            <p key={turn.id} className="mc-talk-speech">
              {turn.text}
            </p>
          )
        })}
        <p className="mc-talk-meta">~{conversation.readingSeconds}s · live feeds only</p>
      </div>

      <MissionCommandCenter
        seedPrompt={seed}
        onSeedConsumed={() => setSeed(null)}
        suggestions={conversation.suggestions}
        onPickSuggestion={(s) => setSeed(s)}
      />

      <div className="mc-talk-timeline">
        <div className="mc-talk-timeline-head">
          <span>What just happened</span>
          <button type="button" className="pd-tab" onClick={onOpenFeed}>
            Full timeline
          </button>
        </div>
        <MissionFeedPanel condensed limit={8} />
      </div>
    </div>
  )
}

export { useMissionObservations } from './useMissionObservations'
