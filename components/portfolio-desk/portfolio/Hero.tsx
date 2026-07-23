'use client'

import type { HoldingsResponse, PerformancePoint } from '@/types/portfolio-desk'
import { formatPct, formatUsd, formatUsdSigned } from '@/lib/portfolio-desk/format'
import { MiniSparkline } from './PerformanceChart'

export function Hero({
  data,
  loading,
  spark,
  range,
}: {
  data?: HoldingsResponse
  loading: boolean
  spark: PerformancePoint[]
  range: string
}) {
  if (loading && !data) {
    return (
      <section className="pd-hero">
        <div className="pd-eyebrow">TOTAL PORTFOLIO VALUE</div>
        <div className="pd-skeleton" style={{ height: 44, width: 260, marginBottom: 12 }} />
        <div className="pd-skeleton" style={{ height: 120, width: '100%', marginTop: 16 }} />
      </section>
    )
  }

  const total = data?.totalValueUsd ?? 0
  const best = data?.holdings?.[0]
  // Weighted 24h change when Jupiter provides it; else —
  const changes = (data?.holdings ?? []).filter((h) => h.change24hPct != null)
  const weighted =
    changes.length && total > 0
      ? changes.reduce((s, h) => s + (h.change24hPct as number) * (h.valueUsd / total), 0)
      : null
  const absChange = weighted != null ? (total * weighted) / 100 : null
  const up = (weighted ?? 0) >= 0

  return (
    <section className="pd-hero">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="pd-eyebrow">TOTAL PORTFOLIO VALUE</div>
          <div className="pd-hero-value pd-num">{formatUsd(total)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span className={up ? 'pd-badge-up' : 'pd-badge-down'}>
              {up ? '▲' : '▼'} {formatPct(weighted != null ? Math.abs(weighted) : null)}
            </span>
            <span className="pd-num" style={{ color: 'var(--pd-text-dim)', fontSize: 13 }}>
              {absChange != null ? `${formatUsdSigned(absChange)} (${range})` : `— (${range})`}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 26, textAlign: 'right' }}>
          <div>
            <div className="pd-eyebrow" style={{ marginBottom: 4 }}>
              HOLDINGS
            </div>
            <div className="pd-num" style={{ fontSize: 15, fontWeight: 600 }}>
              {data?.holdings.length ?? 0}
            </div>
          </div>
          <div>
            <div className="pd-eyebrow" style={{ marginBottom: 4 }}>
              TOP ASSET
            </div>
            <div className="pd-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--pd-positive)' }}>
              {best?.symbol ?? '—'}
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, height: 120 }}>
        <MiniSparkline series={spark} />
      </div>
    </section>
  )
}
