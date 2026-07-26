'use client'

/**
 * Phase 17.1 — Mission Control OS.
 * Answers: "What should I do right now?"
 * Presentation over existing MissionEngine + Coach + Timeline APIs only.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { MissionCommandCenter } from '@/components/portfolio-desk/mission/MissionCommandCenter'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import { IntelligenceModulesGrid } from '@/components/portfolio-desk/mission/IntelligenceModulesGrid'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'
import {
  buildExecutiveBrief,
  buildMarketNarrative,
  buildMissionPriorities,
  buildPortfolioNarrative,
  buildObservations,
  runningIntelligenceLabel,
} from '@/lib/portfolio-desk/mission-narrative'
import type { ModuleCardView } from '@/types/intelligence'
import type { MissionViewModel } from '@/types/intelligence-core'
import type { ScreenerRow } from '@/lib/providers/types'

export function MissionControlPanel({
  onOpenFeed,
  onOpenMarket: _onOpenMarket,
  onSelectToken: _onSelectToken,
  onSuggestion: _onSuggestion,
  showObservationsInline = false,
}: {
  onOpenFeed: () => void
  onOpenMarket: () => void
  onSelectToken: (row: ScreenerRow) => void
  onSuggestion: (text: string) => void
  showObservationsInline?: boolean
}) {
  const { walletAddress, shortAddr, isConnected } = useSolana()

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

  const modulesQ = useQuery({
    queryKey: ['intelligence-modules'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/modules', { cache: 'no-store' })
      if (!res.ok) return [] as ModuleCardView[]
      const body = (await res.json()) as { modules?: ModuleCardView[] }
      return body.modules ?? []
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  const view = missionQ.data ?? null
  const brief = useMemo(
    () =>
      buildExecutiveBrief({
        displayName: isConnected && shortAddr ? shortAddr : null,
        view,
        loading: missionQ.isLoading,
      }),
    [isConnected, shortAddr, view, missionQ.isLoading],
  )
  const marketN = useMemo(() => buildMarketNarrative(view), [view])
  const portfolioN = useMemo(() => buildPortfolioNarrative(view), [view])
  const priorities = useMemo(() => buildMissionPriorities(view), [view])
  const observations = useMemo(
    () => buildObservations({ view, modules: modulesQ.data ?? [] }),
    [view, modulesQ.data],
  )

  return (
    <div className="mc-os">
      <header className="mc-brief">
        <div className="mc-kicker">Executive Brief</div>
        <h1 className="mc-brief-greet">{brief.greetingLine}</h1>
        {brief.paragraphs.map((p) => (
          <p key={p.slice(0, 48)} className="mc-brief-body">
            {p}
          </p>
        ))}
        {brief.dataGaps.map((g) => (
          <p key={g} className="mc-brief-gap">
            {g}
          </p>
        ))}
        <div className="mc-brief-meta">Estimated reading time · {brief.readingSeconds}s</div>
      </header>

      <MissionCommandCenter />

      <div className="mc-grid-2">
        <article className="mc-prose-card">
          <div className="mc-kicker">Market</div>
          <h3>{marketN.title}</h3>
          {marketN.unavailableReason ? (
            <p>{marketN.unavailableReason}</p>
          ) : (
            marketN.paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)
          )}
          <p className="mc-prose-meta">{marketN.sourcesNote}</p>
        </article>

        <article className="mc-prose-card">
          <div className="mc-kicker">Portfolio</div>
          <h3>{portfolioN.title}</h3>
          {portfolioN.unavailableReason ? (
            <p>{portfolioN.unavailableReason}</p>
          ) : (
            <>
              <p>{portfolioN.healthLine}</p>
              <p>
                Overall risk: <strong>{portfolioN.riskLabel}</strong>
              </p>
              {portfolioN.weakness ? <p>Biggest weakness: {portfolioN.weakness}</p> : null}
              {portfolioN.suggestedAction ? (
                <p>Suggested action: {portfolioN.suggestedAction}</p>
              ) : null}
              {portfolioN.confidenceLabel ? <p>Confidence: {portfolioN.confidenceLabel}</p> : null}
              <div className="mc-stat-row">
                <div className="mc-stat">
                  <div className="mc-stat-label">Value</div>
                  <div className="mc-stat-value">
                    {portfolioN.numbers.totalValueUsd != null
                      ? formatUsd(portfolioN.numbers.totalValueUsd)
                      : '—'}
                  </div>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-label">24H</div>
                  <div className="mc-stat-value">
                    {portfolioN.numbers.dayChangePct != null
                      ? formatPct(portfolioN.numbers.dayChangePct)
                      : '—'}
                  </div>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-label">Top weight</div>
                  <div className="mc-stat-value">
                    {portfolioN.numbers.topWeightSymbol || '—'}
                  </div>
                </div>
              </div>
            </>
          )}
        </article>
      </div>

      <section>
        <h3 className="mc-section-title">Running Intelligence</h3>
        {missionQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 40 }} />
        ) : (view?.running ?? []).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Idle — no automated jobs running right now.
          </p>
        ) : (
          <div className="mc-running">
            {(view?.running ?? []).map((row) => (
              <div key={row.id} className="mc-running-item">
                {runningIntelligenceLabel(row.description, row.kind)}
                <span>live</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mc-section-title">What deserves your attention today</h3>
        {priorities.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)' }}>
            No prioritized items yet — priorities appear from grounded recommendations, live jobs,
            or a stored daily brief.
          </p>
        ) : (
          <div className="mc-priorities">
            {priorities.map((p) => (
              <div key={p.id} className="mc-priority">
                <div
                  className={`mc-priority-level${
                    p.level === 'High' ? ' is-high' : p.level === 'Medium' ? ' is-medium' : ''
                  }`}
                >
                  {p.level}
                </div>
                <div>
                  <h4>{p.title}</h4>
                  <p>{p.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <h3 className="mc-section-title" style={{ margin: 0 }}>
            Mission Feed
          </h3>
          <button type="button" className="pd-tab" onClick={onOpenFeed}>
            Full timeline
          </button>
        </div>
        <MissionFeedPanel condensed limit={10} />
      </section>

      {showObservationsInline ? (
        <section className="mc-prose-card">
          <div className="mc-kicker">Observations</div>
          <ul className="mc-obs-list">
            {observations.map((o) => (
              <li key={o.id}>{o.text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="mc-modules-foot">
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--pd-text-faint)',
            marginBottom: 10,
          }}
        >
          Intelligence modules (detail)
        </summary>
        <IntelligenceModulesGrid />
      </details>
    </div>
  )
}

export function useMissionObservations() {
  const { walletAddress } = useSolana()
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
  const modulesQ = useQuery({
    queryKey: ['intelligence-modules'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/modules', { cache: 'no-store' })
      if (!res.ok) return [] as ModuleCardView[]
      const body = (await res.json()) as { modules?: ModuleCardView[] }
      return body.modules ?? []
    },
    staleTime: 20_000,
  })
  return {
    observations: buildObservations({
      view: missionQ.data ?? null,
      modules: modulesQ.data ?? [],
    }),
    loading: missionQ.isLoading,
  }
}
