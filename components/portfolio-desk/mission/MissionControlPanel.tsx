'use client'

/**
 * Mission Control — live Intelligence Core OS surface.
 * Deterministic summaries only. No chat. No OpenAI. No conversational theatre.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { IntelligenceModulesGrid } from '@/components/portfolio-desk/mission/IntelligenceModulesGrid'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import { buildMissionOsSummary } from '@/lib/portfolio-desk/mission-narrative'
import type { MissionViewModel } from '@/types/intelligence-core'
import type { ScreenerRow } from '@/lib/providers/types'

function formatFetchedAt(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function MissionControlPanel({
  onOpenFeed,
  onOpenMarket,
  onSelectToken: _onSelectToken,
  onSuggestion: _onSuggestion,
  onOpenPortfolio,
  onOpenAutomation,
}: {
  onOpenFeed: () => void
  onOpenMarket: () => void
  onSelectToken: (row: ScreenerRow) => void
  onSuggestion: (text: string) => void
  onOpenPortfolio?: () => void
  onOpenAutomation?: () => void
  showObservationsInline?: boolean
}) {
  const { walletAddress, siwsStatus, siwsError, signInSiws } = useSolana()

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

  const os = useMemo(
    () => buildMissionOsSummary(missionQ.data ?? null),
    [missionQ.data],
  )

  const spark = missionQ.data?.market.spark ?? []

  return (
    <div className="mc-os">
      <header className="mc-os-header">
        <div>
          <p className="mc-os-kicker">Mission Control</p>
          <h1 className="mc-os-title">Operating picture</h1>
          <p className="mc-os-status">{os.statusLine}</p>
        </div>
        <div className="mc-os-meta">
          <span className="mc-os-live">Live</span>
          <time dateTime={os.fetchedAt ?? undefined}>{formatFetchedAt(os.fetchedAt)}</time>
        </div>
      </header>

      {siwsStatus === 'error' && siwsError ? (
        <p className="mc-os-note">
          Sign-in needed for a durable account.{' '}
          <button type="button" className="mc-talk-quiet-link" onClick={() => void signInSiws()}>
            Sign again
          </button>
        </p>
      ) : null}

      <section className="mc-os-section" aria-labelledby="mc-os-priorities">
        <div className="mc-os-section-head">
          <h2 id="mc-os-priorities">Priorities</h2>
          <span>Recommendation Engine</span>
        </div>
        {os.priorities.length === 0 ? (
          <p className="mc-os-empty">
            {os.firstRun
              ? 'No history yet — connect a wallet, run a scan, or import a watchlist.'
              : 'No grounded priorities from the Recommendation Engine.'}
          </p>
        ) : (
          <ul className="mc-os-priority-list">
            {os.priorities.map((p) => (
              <li key={p.id}>
                <span className={`mc-os-level is-${p.level.toLowerCase()}`}>{p.level}</span>
                <div>
                  <strong>{p.title}</strong>
                  <p>{p.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mc-os-grid">
        <section className="mc-os-section" aria-labelledby="mc-os-market">
          <div className="mc-os-section-head">
            <h2 id="mc-os-market">Market</h2>
            <button type="button" className="mc-talk-quiet-link" onClick={onOpenMarket}>
              Market Intelligence
            </button>
          </div>
          <p className="mc-os-headline">{os.marketHeadline}</p>
          {os.marketDetail ? <p className="mc-os-detail">{os.marketDetail}</p> : null}
          {os.marketMetrics.length > 0 ? (
            <dl className="mc-os-metrics">
              {os.marketMetrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd className="pd-num">{m.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {spark.length > 1 ? (
            <div className="mc-os-spark" aria-hidden>
              {spark.map((v, i) => (
                <span
                  key={i}
                  style={{
                    height: `${8 + Math.max(0, Math.min(28, Math.abs(v) * 2))}px`,
                    opacity: 0.35 + (i / spark.length) * 0.65,
                  }}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="mc-os-section" aria-labelledby="mc-os-portfolio">
          <div className="mc-os-section-head">
            <h2 id="mc-os-portfolio">Portfolio</h2>
            {onOpenPortfolio ? (
              <button type="button" className="mc-talk-quiet-link" onClick={onOpenPortfolio}>
                Portfolio Intelligence
              </button>
            ) : null}
          </div>
          <p className="mc-os-headline">{os.portfolioHeadline}</p>
          {os.portfolioDetail ? <p className="mc-os-detail">{os.portfolioDetail}</p> : null}
          {os.riskSymbol ? (
            <p className="mc-os-risk">
              <strong>{os.riskSymbol}</strong>
              <span>Primary concentration</span>
            </p>
          ) : null}
          {os.portfolioMetrics.length > 0 ? (
            <dl className="mc-os-metrics">
              {os.portfolioMetrics.map((m) => (
                <div key={m.label} className={os.riskSymbol && m.value === os.riskSymbol ? 'is-risk' : undefined}>
                  <dt>{m.label}</dt>
                  <dd className="pd-num">{m.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      </div>

      <section className="mc-os-section" aria-labelledby="mc-os-brief">
        <div className="mc-os-section-head">
          <h2 id="mc-os-brief">{os.briefTitle}</h2>
          <span>Mission Engine</span>
        </div>
        <p className="mc-os-brief">{os.briefBody}</p>
      </section>

      <section className="mc-os-section" aria-labelledby="mc-os-auto">
        <div className="mc-os-section-head">
          <h2 id="mc-os-auto">Automation</h2>
          {onOpenAutomation ? (
            <button type="button" className="mc-talk-quiet-link" onClick={onOpenAutomation}>
              Automation
            </button>
          ) : null}
        </div>
        {os.automationLines.length === 0 ? (
          <p className="mc-os-empty">No live automation jobs.</p>
        ) : (
          <ul className="mc-os-auto-list">
            {os.automationLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mc-os-section" aria-labelledby="mc-os-feed">
        <div className="mc-os-section-head">
          <h2 id="mc-os-feed">Timeline</h2>
          <button type="button" className="mc-talk-quiet-link" onClick={onOpenFeed}>
            Full Mission Feed
          </button>
        </div>
        <MissionFeedPanel condensed limit={8} emphasizeLatest={2} live />
      </section>

      <section className="mc-os-section mc-os-modules" aria-labelledby="mc-os-modules">
        <div className="mc-os-section-head">
          <h2 id="mc-os-modules">Intelligence Modules</h2>
          <span>Mission Engine</span>
        </div>
        <IntelligenceModulesGrid />
      </section>
    </div>
  )
}

export { useMissionObservations } from './useMissionObservations'
