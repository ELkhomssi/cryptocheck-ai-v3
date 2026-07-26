'use client'

/**
 * Mission Control — OS home.
 * Phase 17: data via MissionEngine (`/api/intelligence-core/mission`).
 * Visual design of original sections unchanged; Recommendations + Daily Brief added.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import { IntelligenceModulesGrid } from '@/components/portfolio-desk/mission/IntelligenceModulesGrid'
import { TokenSearch } from '@/components/portfolio-desk/token/TokenSearch'
import { MiniSparkline } from '@/components/portfolio-desk/portfolio/PerformanceChart'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'
import type { ScreenerRow } from '@/lib/providers/types'
import type { MissionViewModel } from '@/types/intelligence-core'

const SUGGESTIONS = [
  'Scan my portfolio risk',
  'Show top movers today',
  'Find new Solana launches',
  'Audit liquidity on a mint',
]

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="pd-panel" style={{ padding: 16, marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, letterSpacing: '0.04em' }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function MissionControlPanel({
  onOpenFeed,
  onOpenMarket,
  onSelectToken,
  onSuggestion,
}: {
  onOpenFeed: () => void
  onOpenMarket: () => void
  onSelectToken: (row: ScreenerRow) => void
  onSuggestion: (text: string) => void
}) {
  const { walletAddress, isConnected } = useSolana()

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

  const view = missionQ.data
  const marketSpark: { t: number; valueUsd: number }[] = useMemo(() => {
    const spark = view?.market.spark ?? []
    return spark.map((v, i) => ({ t: i, valueUsd: v }))
  }, [view?.market.spark])

  return (
    <div>
      <IntelligenceModulesGrid />

      <Section
        title="Market Status"
        action={
          <button type="button" className="pd-tab" onClick={onOpenMarket}>
            Open Market Intelligence
          </button>
        }
      >
        {missionQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 64 }} />
        ) : !view?.market.available ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Market glance unavailable — providers returned no rows.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>AGGREGATE 24H</div>
              <div
                className="pd-num"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color:
                    (view.market.aggregateChange24hPct ?? 0) > 0
                      ? 'var(--pd-positive)'
                      : (view.market.aggregateChange24hPct ?? 0) < 0
                        ? 'var(--pd-negative)'
                        : undefined,
                }}
              >
                {formatPct(view.market.aggregateChange24hPct ?? 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>TOP MOVER</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {view.market.topMoverSymbol || '—'}{' '}
                <span className="pd-num" style={{ fontSize: 13 }}>
                  {formatPct(view.market.topMoverChange24hPct ?? 0)}
                </span>
              </div>
            </div>
            <div style={{ height: 48 }}>
              <MiniSparkline series={marketSpark} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Portfolio Status">
        {!isConnected ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Connect a wallet to load live portfolio health.
          </p>
        ) : missionQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 64 }} />
        ) : view?.portfolio.error ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-negative)' }}>
            Portfolio fetch failed — retry from Portfolio Intelligence.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>VALUE</div>
              <div className="pd-num" style={{ fontSize: 18, fontWeight: 700 }}>
                {formatUsd(view?.portfolio.totalValueUsd ?? 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>24H</div>
              <div className="pd-num" style={{ fontSize: 18, fontWeight: 700 }}>
                {view?.portfolio.dayChangePct != null
                  ? formatPct(view.portfolio.dayChangePct)
                  : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>TOP WEIGHT</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {view?.portfolio.topWeightSymbol || '—'}
              </div>
            </div>
            <div style={{ height: 40 }}>
              <MiniSparkline series={marketSpark} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Running Intelligence">
        {missionQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 40 }} />
        ) : (view?.running ?? []).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Idle — no automated jobs running right now.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(view?.running ?? []).map((row) => (
              <li
                key={row.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--pd-border-soft)',
                  fontSize: 13,
                }}
              >
                {row.description || `Running ${row.kind}`}
                <span
                  className="pd-num"
                  style={{ marginLeft: 8, fontSize: 10, color: 'var(--pd-accent)' }}
                >
                  live
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recommendations">
        {missionQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 40 }} />
        ) : (view?.recommendations ?? []).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)' }}>
            No grounded recommendations yet — explanations appear only when real metric diffs
            exist.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(view?.recommendations ?? []).map((r, i) => (
              <li
                key={r.predictionId || `${r.title}-${i}`}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--pd-border-soft)',
                }}
              >
                <strong style={{ fontSize: 13 }}>{r.title}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--pd-text-dim)' }}>
                  {r.explanation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Daily Brief">
        {missionQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 40 }} />
        ) : view?.dailyBrief.pending ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-accent)' }}>
            {view.dailyBrief.body}
          </p>
        ) : (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              {view?.dailyBrief.title || 'Morning Brief'}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: view?.dailyBrief.insufficientActivity
                  ? 'var(--pd-text-dim)'
                  : 'var(--pd-text)',
                whiteSpace: 'pre-wrap',
                fontStyle: view?.dailyBrief.insufficientActivity ? 'italic' : undefined,
              }}
            >
              {view?.dailyBrief.body}
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Mission Feed"
        action={
          <button type="button" className="pd-tab" onClick={onOpenFeed}>
            Full feed
          </button>
        }
      >
        <MissionFeedPanel condensed limit={24} />
      </Section>

      <Section title="Command Center">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--pd-text-dim)' }}>
          Search a token to chart, watch, or swap — Intelligence Modules handle routing behind the
          scenes. Status copy names the module, not individual workers.
        </p>
        <TokenSearch
          showShortcut
          placeholder="Command Center — search tokens…"
          onSelect={onSelectToken}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="pd-tab" onClick={() => onSuggestion(s)}>
              {s}
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}
