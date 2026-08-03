'use client'

import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import type { Holding } from '@/types/portfolio-desk'

export function PortfolioSummary({
  connected,
  summary,
  worst,
  loading,
  onOpenHistory,
}: {
  connected: boolean
  summary: PortfolioHealthSummary | null
  worst: Holding | null
  loading: boolean
  onOpenHistory?: () => void
}) {
  if (!connected) {
    return (
      <section className="aios-portfolio" aria-label="Portfolio summary">
        <p className="aios-kicker">Portfolio</p>
        <h2 className="aios-portfolio-title">Connect a wallet to open your book</h2>
        <p className="aios-muted">
          The OS already watches markets. Your holdings unlock risk, rotation, and DNA match.
        </p>
      </section>
    )
  }

  if (loading && !summary) {
    return (
      <section className="aios-portfolio" aria-label="Portfolio summary">
        <p className="aios-kicker">Portfolio</p>
        <div className="aios-skeleton aios-skeleton-lg" />
      </section>
    )
  }

  if (!summary) {
    return (
      <section className="aios-portfolio" aria-label="Portfolio summary">
        <p className="aios-kicker">Portfolio</p>
        <h2 className="aios-portfolio-title">Book unavailable</h2>
        <p className="aios-muted">Holdings could not be loaded — nothing fabricated.</p>
      </section>
    )
  }

  const pnlTone =
    summary.pnl24hPct > 0.15 ? 'up' : summary.pnl24hPct < -0.15 ? 'down' : 'flat'

  return (
    <section className="aios-portfolio" aria-label="Portfolio summary">
      <div className="aios-portfolio-head">
        <div>
          <p className="aios-kicker">Portfolio</p>
          <h2 className="aios-portfolio-value">{formatUsd(summary.totalAssetsUsd)}</h2>
        </div>
        <button type="button" className="aios-link" onClick={onOpenHistory}>
          History
        </button>
      </div>
      <div className="aios-portfolio-meta">
        <span data-tone={pnlTone}>
          24h {formatPct(summary.pnl24hPct)} · {formatUsd(summary.pnl24hUsd)}
        </span>
        <span>Health {summary.aiHealthScore}/100</span>
        {worst ? (
          <span data-tone="down">
            Weakest {worst.symbol} {formatPct(worst.change24hPct)}
          </span>
        ) : null}
      </div>
    </section>
  )
}
