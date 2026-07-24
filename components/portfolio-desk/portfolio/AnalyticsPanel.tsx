'use client'

import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { formatUsd, formatUsdSigned } from '@/lib/portfolio-desk/format'
import type { PortfolioAnalytics } from '@/types/portfolio-desk'

async function fetchAnalytics(wallet: string): Promise<PortfolioAnalytics> {
  const res = await fetch(`/api/portfolio/analytics?wallet=${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Analytics unavailable')
  }
  return (await res.json()) as PortfolioAnalytics
}

function corrColor(v: number | null): string {
  if (v == null) return 'var(--pd-text-faint)'
  if (v >= 0.6) return 'var(--pd-negative)'
  if (v <= -0.3) return 'var(--pd-positive)'
  return 'var(--pd-text-dim)'
}

export function AnalyticsPanel() {
  const { walletAddress, isConnected } = useSolana()
  const q = useQuery({
    queryKey: ['portfolio-analytics', walletAddress],
    queryFn: () => fetchAnalytics(walletAddress!),
    enabled: Boolean(isConnected && walletAddress),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  if (!isConnected) {
    return (
      <section className="pd-panel pd-empty">
        <h3>Analytics</h3>
        <p>Connect a wallet to compute allocation, concentration, and cost-basis analytics.</p>
      </section>
    )
  }

  if (q.isLoading && !q.data) {
    return (
      <section className="pd-panel" style={{ padding: 18 }}>
        <div className="pd-panel-head" style={{ padding: 0, border: 'none', marginBottom: 12 }}>
          <h2>Analytics</h2>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pd-skeleton" style={{ height: 36, marginBottom: 10 }} />
        ))}
      </section>
    )
  }

  if (q.isError) {
    return (
      <section className="pd-panel" style={{ padding: 18 }}>
        <div className="pd-panel-head" style={{ padding: 0, border: 'none', marginBottom: 12 }}>
          <h2>Analytics</h2>
        </div>
        <p style={{ color: 'var(--pd-negative)', fontSize: 13 }}>
          {(q.error as Error)?.message || 'Analytics failed'}
        </p>
        <button type="button" className="pd-connect" style={{ marginTop: 10 }} onClick={() => void q.refetch()}>
          Retry
        </button>
      </section>
    )
  }

  const a = q.data!

  return (
    <section className="pd-panel" style={{ padding: 0 }}>
      <div className="pd-panel-head">
        <h2>Analytics</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>FIFO · Helius</span>
      </div>

      <div className="pd-metrics" style={{ padding: '0 16px 8px', margin: 0 }}>
        {[
          {
            label: 'Unrealized P&L',
            value: a.unrealizedPnl == null ? '—' : formatUsdSigned(a.unrealizedPnl),
            hint: a.unrealizedPnl == null ? 'Needs cost basis' : 'Mark − FIFO entry',
          },
          {
            label: 'Realized P&L',
            value: a.realizedPnl == null ? '—' : formatUsdSigned(a.realizedPnl),
            hint: a.realizedPnl == null ? 'Needs trade history' : 'Closed FIFO lots',
          },
          {
            label: 'Win Rate',
            value: a.winRate == null ? '—' : `${(a.winRate * 100).toFixed(0)}%`,
            hint: a.winRate == null ? 'No closed trades' : 'Winning closed sells',
          },
          {
            label: 'Concentration',
            value: a.concentration.toFixed(3),
            hint: `HHI · div ${(a.diversification * 100).toFixed(0)}%`,
          },
          {
            label: 'Risk Exposure',
            value: a.riskExposure == null ? '—' : String(a.riskExposure),
            hint: a.riskExposure == null ? 'Insufficient marks' : 'Value-weighted 0–100',
          },
          {
            label: 'Holdings',
            value: String(a.holdings.length),
            hint: formatUsd(a.totalValueUsd),
          },
        ].map((c) => (
          <article key={c.label} className="pd-mcard">
            <div className="ml">{c.label}</div>
            <div className="mv pd-num">{c.value}</div>
            <div className="ms">{c.hint}</div>
          </article>
        ))}
      </div>

      {a.limitations ? (
        <p
          style={{
            margin: '0 16px 14px',
            fontSize: 11.5,
            color: 'var(--pd-text-faint)',
            lineHeight: 1.45,
          }}
        >
          {a.limitations}
        </p>
      ) : null}

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Allocation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {a.allocation.slice(0, 10).map((slice) => (
            <div
              key={slice.mint}
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}
            >
              <span style={{ width: 56, fontWeight: 600 }}>{slice.symbol}</span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: 'var(--pd-surface-2)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(2, slice.weight * 100))}%`,
                    background: 'var(--pd-accent)',
                  }}
                />
              </div>
              <span className="pd-num" style={{ width: 52, textAlign: 'right', color: 'var(--pd-text-dim)' }}>
                {(slice.weight * 100).toFixed(1)}%
              </span>
              <span className="pd-num" style={{ width: 72, textAlign: 'right' }}>
                {formatUsd(slice.valueUsd)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {a.correlationMatrix.mints.length >= 2 ? (
        <div style={{ padding: '0 16px 18px', overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Correlation (30D returns)
          </div>
          <table className="pd-table" style={{ minWidth: 280 }}>
            <thead>
              <tr>
                <th />
                {a.correlationMatrix.symbols.map((s) => (
                  <th key={s} className="num">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.correlationMatrix.symbols.map((rowSym, i) => (
                <tr key={rowSym}>
                  <td style={{ fontWeight: 600 }}>{rowSym}</td>
                  {a.correlationMatrix.matrix[i]!.map((v, j) => (
                    <td
                      key={`${i}-${j}`}
                      className="num pd-num"
                      style={{ color: corrColor(v) }}
                    >
                      {v == null ? '—' : v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {a.holdings.some((h) => h.avgEntryPriceUsd != null) ? (
        <div style={{ padding: '0 16px 18px', overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Avg entry (FIFO)</div>
          <table className="pd-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>Token</th>
                <th className="num">Avg Entry</th>
                <th className="num">Mark</th>
                <th className="num">Unrealized</th>
                <th className="num">Realized</th>
              </tr>
            </thead>
            <tbody>
              {a.holdings.map((h) => (
                <tr key={h.mint}>
                  <td style={{ fontWeight: 600 }}>{h.symbol}</td>
                  <td className="num pd-num">
                    {h.avgEntryPriceUsd == null ? '—' : formatUsd(h.avgEntryPriceUsd, true)}
                  </td>
                  <td className="num pd-num">{formatUsd(h.priceUsd, h.priceUsd < 1)}</td>
                  <td
                    className="num pd-num"
                    style={{
                      color:
                        h.unrealizedPnlUsd == null
                          ? 'var(--pd-text-faint)'
                          : h.unrealizedPnlUsd >= 0
                            ? 'var(--pd-positive)'
                            : 'var(--pd-negative)',
                    }}
                  >
                    {h.unrealizedPnlUsd == null ? '—' : formatUsdSigned(h.unrealizedPnlUsd)}
                  </td>
                  <td className="num pd-num">
                    {h.realizedPnlUsd == null ? '—' : formatUsdSigned(h.realizedPnlUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
