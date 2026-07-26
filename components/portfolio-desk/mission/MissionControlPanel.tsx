'use client'

/**
 * Mission Control — the OS speaks. Conversation first.
 * Evidence, metrics, and timeline live below the fold.
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

  const hasBelow =
    conversation.evidence.length > 0 ||
    conversation.metrics.length > 0 ||
    true /* timeline always available below */

  return (
    <div className="mc-talk">
      <div className="mc-talk-stage">
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
                <div key={turn.id} className="mc-talk-live" aria-label="Living intelligence">
                  {turn.text.split('\n').map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              )
            }
            return (
              <p key={turn.id} className="mc-talk-speech">
                {turn.text}
              </p>
            )
          })}
        </div>
      </div>

      <MissionCommandCenter
        seedPrompt={seed}
        onSeedConsumed={() => setSeed(null)}
        suggestions={conversation.suggestions}
        onPickSuggestion={(s) => setSeed(s)}
      />

      {hasBelow ? (
        <div className="mc-talk-below">
          {conversation.evidence.length > 0 ? (
            <section className="mc-talk-section">
              <h3 className="mc-talk-section-label">Why this matters</h3>
              {conversation.evidence.map((line) => (
                <p key={line} className="mc-talk-evidence">
                  {line}
                </p>
              ))}
            </section>
          ) : null}

          {conversation.metrics.length > 0 ? (
            <section className="mc-talk-section">
              <h3 className="mc-talk-section-label">Supporting numbers</h3>
              <dl className="mc-talk-metrics">
                {conversation.metrics.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd className="pd-num">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="mc-talk-section">
            <div className="mc-talk-section-row">
              <h3 className="mc-talk-section-label">Memory</h3>
              <button type="button" className="mc-talk-quiet-link" onClick={onOpenFeed}>
                Open full memory
              </button>
            </div>
            <MissionFeedPanel condensed limit={8} />
          </section>
        </div>
      ) : null}
    </div>
  )
}

export { useMissionObservations } from './useMissionObservations'
