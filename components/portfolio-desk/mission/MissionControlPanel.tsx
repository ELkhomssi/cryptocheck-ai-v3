'use client'

/**
 * Mission Control — speech drives the interface.
 * Each spoken beat unlocks a real proof surface from existing engines.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { MissionCommandCenter } from '@/components/portfolio-desk/mission/MissionCommandCenter'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import {
  activeProofAt,
  buildMissionConversation,
  proofsUnlockedThrough,
  runningIntelligenceLabel,
  speechHoldMs,
  type SpeechProof,
} from '@/lib/portfolio-desk/mission-narrative'
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
  const [spokenCount, setSpokenCount] = useState(1)
  const proofRef = useRef<HTMLDivElement | null>(null)

  const missionQ = useQuery({
    queryKey: ['intelligence-core-mission', walletAddress],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/intelligence-core/mission${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Mission view unavailable')
      return (await res.json()) as MissionViewModel
    },
    refetchInterval: 8_000,
    staleTime: 4_000,
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

  // Reset speech when a new briefing arrives (not on every living-job tick).
  useEffect(() => {
    setSpokenCount(1)
  }, [briefingKey])

  // Advance speech one sentence at a time — proof mounts with each beat.
  useEffect(() => {
    if (spokenCount >= conversation.turns.length) return
    // Hold on the latest spoken sentence, then reveal the next.
    const turn = conversation.turns[spokenCount - 1]
    if (!turn) return
    const t = window.setTimeout(() => {
      setSpokenCount((n) => Math.min(n + 1, conversation.turns.length))
    }, speechHoldMs(turn.text))
    return () => window.clearTimeout(t)
  }, [spokenCount, conversation.turns])

  const safeSpoken = Math.min(spokenCount, conversation.turns.length)
  const unlocked = proofsUnlockedThrough(conversation.turns, safeSpoken)
  const active = activeProofAt(conversation.turns, safeSpoken)
  const actionsReady = unlocked.includes('actions')
  const spokenTurns = conversation.turns.slice(0, safeSpoken)

  // Live living lines from latest mission payload (updates while speech runs).
  const liveLiving = useMemo(() => {
    const running = missionQ.data?.running ?? []
    if (running.length === 0) return conversation.living
    return running.slice(0, 4).map((r) => runningIntelligenceLabel(r.description, r.kind))
  }, [missionQ.data?.running, conversation.living])

  useEffect(() => {
    if (active === 'none') return
    proofRef.current?.querySelector(`[data-proof="${active}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [active, spokenCount])

  return (
    <div className="mc-talk">
      <div className="mc-live-screen">
        <div className="mc-live-speech">
          <div className="mc-talk-thread" aria-live="polite">
            {spokenTurns.map((turn) => (
              <p
                key={turn.id}
                className={
                  turn.kind === 'propose'
                    ? 'mc-talk-propose mc-beat'
                    : turn.id === 'greet'
                      ? 'mc-talk-speech mc-talk-greet mc-beat'
                      : 'mc-talk-speech mc-beat'
                }
              >
                {turn.text}
              </p>
            ))}
            {safeSpoken < conversation.turns.length ? (
              <p className="mc-talk-cursor" aria-hidden>
                ▍
              </p>
            ) : null}
          </div>

          {actionsReady ? (
            <MissionCommandCenter
              seedPrompt={seed}
              onSeedConsumed={() => setSeed(null)}
              suggestions={[]}
              onPickSuggestion={(s) => setSeed(s)}
            />
          ) : null}
        </div>

        <div className="mc-live-proof" ref={proofRef} aria-live="polite">
          {unlocked.length === 0 ? (
            <p className="mc-proof-wait">Listening to live engines…</p>
          ) : null}

          {unlocked.includes('living') ? (
            <ProofPanel id="living" active={active === 'living'} label="Currently working">
              {liveLiving.length > 0 ? (
                <ul className="mc-proof-list">
                  {liveLiving.map((line) => (
                    <li key={line} className="mc-proof-live-item">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mc-talk-evidence">No critical jobs running. Monitoring continues.</p>
              )}
            </ProofPanel>
          ) : null}

          {unlocked.includes('feed') ? (
            <ProofPanel id="feed" active={active === 'feed'} label="While you were away">
              <MissionFeedPanel
                condensed
                limit={5}
                emphasizeLatest={active === 'feed' ? 2 : 0}
                live
              />
              <button type="button" className="mc-talk-quiet-link" onClick={onOpenFeed}>
                Open full Mission Feed
              </button>
            </ProofPanel>
          ) : null}

          {unlocked.includes('market') ? (
            <ProofPanel id="market" active={active === 'market'} label="Market conclusion">
              {conversation.marketMetrics.length > 0 ? (
                <dl className="mc-talk-metrics">
                  {conversation.marketMetrics.map((m) => (
                    <div key={m.label} className={active === 'market' ? 'mc-metric-flash' : undefined}>
                      <dt>{m.label}</dt>
                      <dd className="pd-num">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mc-talk-evidence">I don’t have enough market sample yet.</p>
              )}
              {conversation.evidence
                .filter((e) => /sample|move/i.test(e))
                .slice(0, 2)
                .map((line) => (
                  <p key={line} className="mc-talk-evidence">
                    {line}
                  </p>
                ))}
            </ProofPanel>
          ) : null}

          {unlocked.includes('portfolio') ? (
            <ProofPanel
              id="portfolio"
              active={active === 'portfolio'}
              label="Your portfolio today"
              expanded={active === 'portfolio' || Boolean(conversation.riskSymbol)}
            >
              {conversation.portfolioMetrics.length > 0 ? (
                <dl className="mc-talk-metrics">
                  {conversation.portfolioMetrics.map((m) => (
                    <div
                      key={m.label}
                      className={
                        conversation.riskSymbol && m.value === conversation.riskSymbol
                          ? 'mc-metric-risk'
                          : undefined
                      }
                    >
                      <dt>{m.label}</dt>
                      <dd className="pd-num">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mc-talk-evidence">
                  {isConnected
                    ? 'I don’t have enough portfolio detail yet.'
                    : 'Connect a wallet to unlock portfolio proof.'}
                </p>
              )}
              {conversation.riskSymbol ? (
                <div className="mc-risk-callout">
                  <strong>{conversation.riskSymbol}</strong>
                  <span>Largest concentration — primary risk to review.</span>
                </div>
              ) : null}
            </ProofPanel>
          ) : null}

          {unlocked.includes('attention') ? (
            <ProofPanel
              id="attention"
              active={active === 'attention'}
              label="Things requiring your attention"
            >
              {conversation.attention.length > 0 ? (
                <ul className="mc-proof-list">
                  {conversation.attention.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mc-talk-evidence">Nothing else requires action right now.</p>
              )}
              {conversation.evidence
                .filter((e) => !/sample|move|Portfolio value/i.test(e))
                .slice(0, 2)
                .map((line) => (
                  <p key={line} className="mc-talk-evidence">
                    {line}
                  </p>
                ))}
            </ProofPanel>
          ) : null}

          {unlocked.includes('actions') ? (
            <ProofPanel id="actions" active={active === 'actions'} label="Prepared actions" expanded>
              <ul className="mc-action-cards">
                {conversation.preparedActions.map((action, i) => (
                  <li
                    key={action}
                    className="mc-action-card"
                    style={{ ['--mc-delay' as string]: `${i * 0.12}s` }}
                  >
                    <button type="button" onClick={() => setSeed(action)}>
                      {action}
                    </button>
                  </li>
                ))}
              </ul>
            </ProofPanel>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ProofPanel({
  id,
  label,
  active,
  expanded,
  children,
}: {
  id: SpeechProof
  label: string
  active: boolean
  expanded?: boolean
  children: ReactNode
}) {
  return (
    <section
      data-proof={id}
      className={`mc-proof${active ? ' is-active' : ''}${expanded || active ? ' is-expanded' : ''}`}
    >
      <h3 className="mc-talk-section-label">{label}</h3>
      {children}
    </section>
  )
}

export { useMissionObservations } from './useMissionObservations'
