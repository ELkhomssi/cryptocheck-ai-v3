'use client'

/**
 * Mission Control — first screen is ONLY the spoken briefing.
 * Evidence, metrics, living activity, and memory begin after that.
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
      {/* FIRST SCREEN — conversation only */}
      <div className="mc-talk-screen">
        <div className="mc-talk-thread" aria-live="polite">
          {conversation.turns.map((turn) =>
            turn.kind === 'ask' ? (
              <p key={turn.id} className="mc-talk-ask">
                {turn.text}
              </p>
            ) : (
              <p key={turn.id} className="mc-talk-speech">
                {turn.text}
              </p>
            ),
          )}
        </div>

        <MissionCommandCenter
          seedPrompt={seed}
          onSeedConsumed={() => setSeed(null)}
          suggestions={[]}
          onPickSuggestion={(s) => setSeed(s)}
        />
      </div>

      {/* AFTER the conversation — supporting layers only */}
      <div className="mc-talk-below">
        {conversation.evidence.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Supporting evidence</h3>
            {conversation.evidence.map((line) => (
              <p key={line} className="mc-talk-evidence">
                {line}
              </p>
            ))}
          </section>
        ) : null}

        {conversation.marketMetrics.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Market metrics</h3>
            <dl className="mc-talk-metrics">
              {conversation.marketMetrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd className="pd-num">{m.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {conversation.portfolioMetrics.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Portfolio metrics</h3>
            <dl className="mc-talk-metrics">
              {conversation.portfolioMetrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd className="pd-num">{m.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {conversation.living.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Still watching</h3>
            <div className="mc-talk-live">
              {conversation.living.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </section>
        ) : null}

        {conversation.suggestions.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Also available</h3>
            <div className="mc-listen-suggestions">
              {conversation.suggestions.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="mc-listen-chip"
                  onClick={() => setSeed(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mc-talk-section">
          <div className="mc-talk-section-row">
            <h3 className="mc-talk-section-label">Timeline</h3>
            <button type="button" className="mc-talk-quiet-link" onClick={onOpenFeed}>
              Mission Feed
            </button>
          </div>
          <MissionFeedPanel condensed limit={8} />
        </section>
      </div>
    </div>
  )
}

export { useMissionObservations } from './useMissionObservations'
