'use client'

/**
 * Mission Control — CEO briefing experience.
 * Reconstruct → conclude → one conclusion + one proof at a time.
 * Presentation only. No fake data. No widget walls.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { MissionCommandCenter } from '@/components/portfolio-desk/mission/MissionCommandCenter'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import {
  buildMissionConversation,
  runningIntelligenceLabel,
  speechHoldMs,
  type SpeechProof,
  type SpeechTurn,
} from '@/lib/portfolio-desk/mission-narrative'
import type { MissionViewModel } from '@/types/intelligence-core'
import type { ScreenerRow } from '@/lib/providers/types'

type Phase = 'reconstruct' | 'speak'

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
  const [phase, setPhase] = useState<Phase>('reconstruct')
  const [spokenCount, setSpokenCount] = useState(0)

  const missionQ = useQuery({
    queryKey: ['intelligence-core-mission', walletAddress],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/intelligence-core/mission${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Mission view unavailable')
      return (await res.json()) as MissionViewModel
    },
    refetchInterval: phase === 'speak' ? 10_000 : 5_000,
    staleTime: 3_000,
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

  const briefingKey = missionQ.isLoading
    ? 'loading'
    : `${missionQ.data?.fetchedAt ?? 'ready'}:${walletAddress ?? 'anon'}`

  // New briefing → reconstruct first (engines already ran; we surface status).
  useEffect(() => {
    setPhase('reconstruct')
    setSpokenCount(0)
  }, [briefingKey])

  // After engines report done, hold reconstruct briefly, then speak.
  useEffect(() => {
    if (phase !== 'reconstruct') return
    if (missionQ.isLoading || !missionQ.data) return
    const t = window.setTimeout(() => {
      setPhase('speak')
      setSpokenCount(1)
    }, 2200)
    return () => window.clearTimeout(t)
  }, [phase, missionQ.isLoading, missionQ.data])

  // One conclusion at a time.
  useEffect(() => {
    if (phase !== 'speak') return
    if (spokenCount <= 0) return
    if (spokenCount >= conversation.turns.length) return
    const turn = conversation.turns[spokenCount - 1]
    if (!turn) return
    const t = window.setTimeout(() => {
      setSpokenCount((n) => Math.min(n + 1, conversation.turns.length))
    }, speechHoldMs(turn.text))
    return () => window.clearTimeout(t)
  }, [phase, spokenCount, conversation.turns])

  const safeSpoken = Math.min(spokenCount, conversation.turns.length)
  const current: SpeechTurn | null =
    phase === 'speak' && safeSpoken > 0 ? conversation.turns[safeSpoken - 1]! : null
  const prior =
    phase === 'speak' && safeSpoken > 1 ? conversation.turns.slice(0, safeSpoken - 1) : []
  const active: SpeechProof = current ? current.proof : 'none'
  const briefingDone = phase === 'speak' && safeSpoken >= conversation.turns.length && conversation.turns.length > 0

  const liveLiving = useMemo(() => {
    const running = missionQ.data?.running ?? []
    if (running.length === 0) return conversation.living
    return running.slice(0, 3).map((r) => runningIntelligenceLabel(r.description, r.kind))
  }, [missionQ.data?.running, conversation.living])

  return (
    <div className="mc-ceo">
      {phase === 'reconstruct' ? (
        <div className="mc-ceo-stage" aria-live="polite">
          <p className="mc-ceo-kicker">Mission Control</p>
          <h1 className="mc-ceo-title">Reconstructing your operating picture.</h1>
          <p className="mc-ceo-sub">
            Reading Market Intelligence, Portfolio Intelligence, Mission Feed, Timeline, and
            Automation — then filtering what deserves your attention.
          </p>
          <ul className="mc-ceo-engines">
            {conversation.reconstruction.map((step) => (
              <li key={step.id} className={step.done ? 'is-done' : 'is-busy'}>
                <span>{step.engine}</span>
                <em>{step.status}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mc-ceo-stage" aria-live="polite">
          {prior.length > 0 ? (
            <div className="mc-ceo-trail">
              {prior.map((t) => (
                <p key={t.id}>{t.text}</p>
              ))}
            </div>
          ) : null}

          {current ? (
            <div className="mc-ceo-focus" key={current.id}>
              <p
                className={
                  current.id === 'greet'
                    ? 'mc-ceo-line mc-ceo-greet'
                    : current.kind === 'propose'
                      ? 'mc-ceo-line mc-ceo-propose'
                      : 'mc-ceo-line'
                }
              >
                {current.text}
              </p>
              {current.meaning ? <p className="mc-ceo-meaning">{current.meaning}</p> : null}

              {active !== 'none' ? (
                <div className="mc-ceo-proof">
                  <p className="mc-ceo-proof-label">Evidence</p>
                  <ActiveProof
                    proof={active}
                    conversation={conversation}
                    liveLiving={liveLiving}
                    isConnected={isConnected}
                    onOpenFeed={onOpenFeed}
                    onPickAction={(a) => setSeed(a)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {briefingDone ? (
            <div className="mc-ceo-listen">
              <MissionCommandCenter
                seedPrompt={seed}
                onSeedConsumed={() => setSeed(null)}
                suggestions={[]}
                onPickSuggestion={(s) => setSeed(s)}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ActiveProof({
  proof,
  conversation,
  liveLiving,
  isConnected,
  onOpenFeed,
  onPickAction,
}: {
  proof: SpeechProof
  conversation: ReturnType<typeof buildMissionConversation>
  liveLiving: string[]
  isConnected: boolean
  onOpenFeed: () => void
  onPickAction: (action: string) => void
}) {
  if (proof === 'living') {
    return liveLiving.length > 0 ? (
      <ul className="mc-ceo-list">
        {liveLiving.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    ) : (
      <p className="mc-ceo-soft">No critical jobs running. Monitoring continues.</p>
    )
  }

  if (proof === 'feed') {
    return (
      <div>
        <MissionFeedPanel condensed limit={3} emphasizeLatest={2} live />
        <button type="button" className="mc-talk-quiet-link" onClick={onOpenFeed}>
          Full Mission Feed
        </button>
      </div>
    )
  }

  if (proof === 'market') {
    return (
      <div>
        {conversation.evidence
          .filter((e) => /sample|move/i.test(e))
          .slice(0, 2)
          .map((line) => (
            <p key={line} className="mc-ceo-soft">
              {line}
            </p>
          ))}
        {conversation.marketMetrics.length > 0 ? (
          <dl className="mc-ceo-nums">
            {conversation.marketMetrics.map((m) => (
              <div key={m.label}>
                <dt>{m.label}</dt>
                <dd className="pd-num">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mc-ceo-soft">I don’t have enough market sample yet.</p>
        )}
      </div>
    )
  }

  if (proof === 'portfolio') {
    return (
      <div>
        {conversation.riskSymbol ? (
          <div className="mc-ceo-risk">
            <strong>{conversation.riskSymbol}</strong>
            <span>Primary concentration risk.</span>
          </div>
        ) : null}
        {conversation.evidence
          .filter((e) => /Portfolio value/i.test(e))
          .slice(0, 1)
          .map((line) => (
            <p key={line} className="mc-ceo-soft">
              {line}
            </p>
          ))}
        {conversation.portfolioMetrics.length > 0 ? (
          <dl className="mc-ceo-nums">
            {conversation.portfolioMetrics.map((m) => (
              <div
                key={m.label}
                className={
                  conversation.riskSymbol && m.value === conversation.riskSymbol
                    ? 'is-risk'
                    : undefined
                }
              >
                <dt>{m.label}</dt>
                <dd className="pd-num">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mc-ceo-soft">
            {isConnected
              ? 'I don’t have enough portfolio detail yet.'
              : 'Connect a wallet to unlock portfolio proof.'}
          </p>
        )}
      </div>
    )
  }

  if (proof === 'attention') {
    return conversation.attention.length > 0 ? (
      <ul className="mc-ceo-list">
        {conversation.attention.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    ) : (
      <p className="mc-ceo-soft">Nothing else requires action right now.</p>
    )
  }

  if (proof === 'actions') {
    return (
      <ul className="mc-ceo-actions">
        {conversation.preparedActions.map((action) => (
          <li key={action}>
            <button type="button" onClick={() => onPickAction(action)}>
              {action}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return null
}

export { useMissionObservations } from './useMissionObservations'
