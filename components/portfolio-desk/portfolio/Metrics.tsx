'use client'

import type { HoldingsResponse } from '@/types/portfolio-desk'
import { formatAmount, formatUsd, formatUsdSigned } from '@/lib/portfolio-desk/format'

export function Metrics({ data, loading }: { data?: HoldingsResponse; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="pd-metrics">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="pd-mcard">
            <div className="pd-skeleton" style={{ height: 14, width: 64, marginBottom: 10 }} />
            <div className="pd-skeleton" style={{ height: 22, width: 88 }} />
          </div>
        ))}
      </div>
    )
  }

  const total = data?.totalValueUsd ?? 0
  const count = data?.holdings.length ?? 0
  const changes = (data?.holdings ?? []).filter((h) => h.change24hPct != null)
  const weighted =
    changes.length && total > 0
      ? changes.reduce((s, h) => s + (h.change24hPct as number) * (h.valueUsd / total), 0)
      : null
  const pnl24 = weighted != null ? (total * weighted) / 100 : null

  const cards = [
    { label: 'Holdings', value: String(count), hint: 'Tokens' },
    {
      label: '24H P&L',
      value: pnl24 != null ? formatUsdSigned(pnl24) : '—',
      hint: weighted != null ? `${weighted >= 0 ? '+' : ''}${weighted.toFixed(2)}%` : 'When 24h available',
    },
    {
      label: 'Unrealized P&L',
      value: '—',
      hint: 'Needs avg buy (Step 7)',
    },
    {
      label: 'Win Rate',
      value: '—',
      hint: 'Needs trade history',
    },
    {
      label: 'Total Invested',
      value: '—',
      hint: 'Needs cost basis',
    },
    {
      label: 'Available Balance',
      value: data ? `${formatAmount(data.availableSol, 9)} SOL` : '—',
      hint: data ? formatUsd(data.availableSolUsd) : 'SOL in wallet',
    },
  ]

  return (
    <div className="pd-metrics">
      {cards.map((c) => (
        <article key={c.label} className="pd-mcard">
          <div className="ml">{c.label}</div>
          <div className="mv pd-num">{c.value}</div>
          <div className="ms">{c.hint}</div>
        </article>
      ))}
    </div>
  )
}
