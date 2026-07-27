'use client'

/**
 * Mission Control — operating system desk (presentation only).
 * No greeting, no scripted speech, no chat landing.
 * Surfaces live MissionViewModel + intelligence modules as operational chrome.
 */

import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { IntelligenceModulesGrid } from '@/components/portfolio-desk/mission/IntelligenceModulesGrid'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'
import type { MissionViewModel } from '@/types/intelligence-core'
import type { ScreenerRow } from '@/lib/providers/types'

export function MissionControlPanel({
  onOpenFeed,
  onOpenMarket,
  onSelectToken: _onSelectToken,
  onSuggestion: _onSuggestion,
}: {
  onOpenFeed: () => void
  onOpenMarket: () => void
  onSelectToken: (row: ScreenerRow) => void
  onSuggestion: (text: string) => void
  showObservationsInline?: boolean
}) {
  const { walletAddress, isConnected, siwsStatus, siwsError, signInSiws, connect } = useSolana()

  const missionQ = useQuery({
    queryKey: ['intelligence-core-mission', walletAddress, siwsStatus],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/intelligence-core/mission${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Mission view unavailable')
      return (await res.json()) as MissionViewModel
    },
    refetchInterval: 10_000,
    staleTime: 3_000,
  })

  const view = missionQ.data
  const loading = missionQ.isLoading && !view

  return (
    <div className="mc-ops">
      {siwsStatus === 'error' && siwsError ? (
        <p className="mc-ops-banner">
          Sign-in needed for a durable account.{' '}
          <button type="button" className="mc-talk-quiet-link" onClick={() => void signInSiws()}>
            Sign again
          </button>
        </p>
      ) : null}

      <section className="mc-ops-metrics" aria-label="Live operating metrics">
        <Metric
          label="Market 24h"
          value={
            loading
              ? '…'
              : view?.market.available
                ? formatPct(view.market.aggregateChange24hPct)
                : '—'
          }
          tone={pctTone(view?.market.aggregateChange24hPct)}
        />
        <Metric
          label="Top mover"
          value={
            loading
              ? '…'
              : view?.market.topMoverSymbol
                ? `${view.market.topMoverSymbol} ${formatPct(view.market.topMoverChange24hPct)}`
                : '—'
          }
          onClick={onOpenMarket}
        />
        <Metric
          label="Portfolio"
          value={
            loading
              ? '…'
              : !isConnected
                ? 'Connect'
                : view?.portfolio.totalValueUsd != null
                  ? formatUsd(view.portfolio.totalValueUsd)
                  : view?.portfolio.error
                    ? '—'
                    : '—'
          }
          hint={
            !isConnected
              ? 'Wallet required'
              : view?.portfolio.dayChangePct != null
                ? formatPct(view.portfolio.dayChangePct)
                : undefined
          }
          tone={pctTone(view?.portfolio.dayChangePct)}
          onClick={!isConnected ? () => void connect() : undefined}
        />
        <Metric
          label="Running"
          value={loading ? '…' : String(view?.running.length ?? 0)}
          hint="Active jobs"
        />
      </section>

      <div className="mc-ops-grid">
        <section className="mc-ops-block">
          <h2 className="pd-section-label">Active jobs</h2>
          {loading ? (
            <div className="pd-skeleton" style={{ height: 72 }} />
          ) : view?.running.length ? (
            <ul className="mc-ops-list">
              {view.running.slice(0, 6).map((job) => (
                <li key={job.id}>
                  <span className="mc-ops-kind">{job.kind}</span>
                  <span>{job.description || '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mc-ops-empty">No active jobs.</p>
          )}
        </section>

        <section className="mc-ops-block">
          <div className="mc-ops-block-head">
            <h2 className="pd-section-label">Mission feed</h2>
            <button type="button" className="mc-talk-quiet-link" onClick={onOpenFeed}>
              Expand
            </button>
          </div>
          <MissionFeedPanel condensed limit={6} live />
        </section>
      </div>

      <section className="mc-ops-block">
        <h2 className="pd-section-label">Recommendations</h2>
        {loading ? (
          <div className="pd-skeleton" style={{ height: 64 }} />
        ) : view?.recommendations.length ? (
          <ul className="mc-ops-recs">
            {view.recommendations.slice(0, 5).map((rec, i) => (
              <li key={`${rec.predictionId ?? rec.title}-${i}`}>
                <strong>{rec.title}</strong>
                <span>{rec.explanation}</span>
                {!rec.grounded ? (
                  <em className="mc-ops-ungrounded">Ungrounded</em>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mc-ops-empty">No recommendations in this window.</p>
        )}
      </section>

      {view?.dailyBrief && !view.dailyBrief.pending && !view.dailyBrief.insufficientActivity ? (
        <section className="mc-ops-block">
          <h2 className="pd-section-label">Daily brief</h2>
          <h3 className="mc-ops-brief-title">{view.dailyBrief.title}</h3>
          <p className="mc-ops-brief-body">{view.dailyBrief.body}</p>
        </section>
      ) : null}

      <IntelligenceModulesGrid />
    </div>
  )
}

function pctTone(n: number | null | undefined): 'up' | 'down' | undefined {
  if (n == null || Number.isNaN(n)) return undefined
  if (n > 0) return 'up'
  if (n < 0) return 'down'
  return undefined
}

function Metric({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'up' | 'down'
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="pd-section-label">{label}</div>
      <div
        className="mc-ops-metric-value pd-num"
        style={
          tone === 'up'
            ? { color: 'var(--pd-positive)' }
            : tone === 'down'
              ? { color: 'var(--pd-negative)' }
              : undefined
        }
      >
        {value}
      </div>
      {hint ? <div className="mc-ops-metric-hint pd-num">{hint}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="mc-ops-metric" onClick={onClick}>
        {body}
      </button>
    )
  }

  return <div className="mc-ops-metric">{body}</div>
}

export { useMissionObservations } from './useMissionObservations'
