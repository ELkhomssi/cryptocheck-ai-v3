'use client'

/**
 * Mission Control — OS home.
 * Condensed real-data sections; idle/empty states are honest.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import { TokenSearch } from '@/components/portfolio-desk/token/TokenSearch'
import { MiniSparkline } from '@/components/portfolio-desk/portfolio/PerformanceChart'
import { useHoldings } from '@/components/portfolio-desk/hooks/useHoldings'
import { usePerformance } from '@/components/portfolio-desk/portfolio/PerformanceChart'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'
import type { ScreenerRow } from '@/lib/providers/types'
import type { AgentActivityRow } from '@/types/agents'

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
  const holdingsQ = useHoldings()
  const perfQ = usePerformance(walletAddress, '24H')

  const marketQ = useQuery({
    queryKey: ['mission-market-glance'],
    queryFn: async () => {
      const res = await fetch('/api/market/screener?limit=12&sort=volume&order=desc', {
        cache: 'no-store',
      })
      if (!res.ok) return { rows: [] as ScreenerRow[], available: false }
      return (await res.json()) as { rows?: ScreenerRow[]; available?: boolean }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const runningQ = useQuery({
    queryKey: ['mission-running-intel'],
    queryFn: async () => {
      const res = await fetch('/api/agents/activity?limit=40&status=running', {
        cache: 'no-store',
      })
      if (!res.ok) return [] as AgentActivityRow[]
      const body = (await res.json()) as { activity?: AgentActivityRow[] }
      return (body.activity ?? []).filter((r) => r.status === 'running')
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const marketStats = useMemo(() => {
    const rows = marketQ.data?.rows ?? []
    if (!rows.length) return null
    const avg =
      rows.reduce((s, r) => s + (Number.isFinite(r.change24hPct) ? r.change24hPct : 0), 0) /
      rows.length
    const top = [...rows].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))[0]
    return { avg, top, spark: rows.slice(0, 8).map((r) => r.change24hPct) }
  }, [marketQ.data])

  const totalUsd = holdingsQ.data?.totalValueUsd
  const dayChange = useMemo(() => {
    const hs = holdingsQ.data?.holdings ?? []
    const withChg = hs.filter((h) => h.change24hPct != null && h.valueUsd > 0)
    if (!withChg.length) return null
    const w = withChg.reduce((s, h) => s + h.valueUsd, 0)
    if (!(w > 0)) return null
    return withChg.reduce((s, h) => s + (h.change24hPct as number) * h.valueUsd, 0) / w
  }, [holdingsQ.data])
  const topRiskSymbol = useMemo(() => {
    const hs = holdingsQ.data?.holdings ?? []
    if (!hs.length) return null
    const top = [...hs].sort((a, b) => b.valueUsd - a.valueUsd)[0]
    return top?.symbol ?? null
  }, [holdingsQ.data])

  const marketSpark: { t: number; valueUsd: number }[] = useMemo(() => {
    if (!marketStats) return []
    return marketStats.spark.map((v, i) => ({ t: i, valueUsd: v }))
  }, [marketStats])

  return (
    <div>
      <Section
        title="Market Status"
        action={
          <button type="button" className="pd-tab" onClick={onOpenMarket}>
            Open Market Intelligence
          </button>
        }
      >
        {marketQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 64 }} />
        ) : !marketStats ? (
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
                    marketStats.avg > 0
                      ? 'var(--pd-positive)'
                      : marketStats.avg < 0
                        ? 'var(--pd-negative)'
                        : undefined,
                }}
              >
                {formatPct(marketStats.avg)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>TOP MOVER</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {marketStats.top?.symbol || '—'}{' '}
                <span className="pd-num" style={{ fontSize: 13 }}>
                  {formatPct(marketStats.top?.change24hPct ?? 0)}
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
        ) : holdingsQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 64 }} />
        ) : holdingsQ.isError ? (
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
                {formatUsd(totalUsd ?? 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>24H</div>
              <div className="pd-num" style={{ fontSize: 18, fontWeight: 700 }}>
                {dayChange != null ? formatPct(dayChange) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>TOP WEIGHT</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{topRiskSymbol || '—'}</div>
            </div>
            <div style={{ height: 40 }}>
              <MiniSparkline series={perfQ.data?.series ?? []} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Running Intelligence">
        {runningQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: 40 }} />
        ) : (runningQ.data ?? []).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Idle — no automated jobs running right now.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(runningQ.data ?? []).map((row) => (
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
          Search a token to chart, watch, or swap — or tap a suggestion to jump into Market
          Intelligence.
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
