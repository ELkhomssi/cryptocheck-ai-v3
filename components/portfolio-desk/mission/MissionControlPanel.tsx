'use client'

/**
 * Mission Control — the OS speaks first, proposes actions, then shows evidence.
 * Presentation only. Institutional voice. Never invents.
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
      {/* Speech → prepared actions → reply */}
      <div className="mc-talk-screen">
        <div className="mc-talk-thread" aria-live="polite">
          {conversation.turns.map((turn, i) => {
            const delay = { ['--mc-delay' as string]: `${Math.min(i * 0.42, 4.2)}s` }
            if (turn.kind === 'propose') {
              return (
                <p key={turn.id} className="mc-talk-propose mc-talk-line" style={delay}>
                  {turn.text}
                </p>
              )
            }
            const cls =
              turn.id === 'presence'
                ? 'mc-talk-speech mc-talk-presence mc-talk-line'
                : turn.id === 'away'
                  ? 'mc-talk-speech mc-talk-away mc-talk-line'
                  : 'mc-talk-speech mc-talk-line'
            return (
              <p key={turn.id} className={cls} style={delay}>
                {turn.text}
              </p>
            )
          })}
        </div>

        <ul
          className="mc-prepared mc-talk-line"
          style={{
            ['--mc-delay' as string]: `${Math.min(conversation.turns.length * 0.42 + 0.2, 4.8)}s`,
          }}
        >
          {conversation.preparedActions.map((action) => (
            <li key={action}>
              <button type="button" className="mc-prepared-item" onClick={() => setSeed(action)}>
                {action}
              </button>
            </li>
          ))}
        </ul>

        <MissionCommandCenter
          seedPrompt={seed}
          onSeedConsumed={() => setSeed(null)}
          suggestions={[]}
          onPickSuggestion={(s) => setSeed(s)}
        />
      </div>

      {/* Evidence → Timeline → Metrics → Currently working */}
      <div className="mc-talk-below">
        {conversation.attention.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Things requiring your attention</h3>
            {conversation.attention.map((line) => (
              <p key={line} className="mc-talk-evidence">
                {line}
              </p>
            ))}
          </section>
        ) : null}

        {conversation.evidence.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">What I discovered</h3>
            {conversation.evidence.map((line) => (
              <p key={line} className="mc-talk-evidence">
                {line}
              </p>
            ))}
          </section>
        ) : null}

        <section className="mc-talk-section">
          <div className="mc-talk-section-row">
            <h3 className="mc-talk-section-label">While you were away…</h3>
            <button type="button" className="mc-talk-quiet-link" onClick={onOpenFeed}>
              Full Mission Feed
            </button>
          </div>
          <MissionFeedPanel condensed limit={5} />
        </section>

        {conversation.portfolioMetrics.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Your portfolio today</h3>
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

        {conversation.marketMetrics.length > 0 ? (
          <section className="mc-talk-section">
            <h3 className="mc-talk-section-label">Market evidence</h3>
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

        <section className="mc-talk-section">
          <h3 className="mc-talk-section-label">Currently working…</h3>
          {conversation.living.length > 0 ? (
            <div className="mc-talk-live">
              {conversation.living.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : (
            <p className="mc-talk-evidence">
              Nothing critical is running. I will continue monitoring the market.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export { useMissionObservations } from './useMissionObservations'
