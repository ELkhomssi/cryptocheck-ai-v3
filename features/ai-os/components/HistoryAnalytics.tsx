'use client'

/**
 * History / Advanced Analytics — bottom collapsible.
 * Surfaces portfolio health detail without becoming a dashboard.
 */

import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'

export function HistoryAnalytics({
  open,
  onToggle,
  summary,
  holdings,
}: {
  open: boolean
  onToggle: () => void
  summary: PortfolioHealthSummary | null
  holdings: HoldingsResponse | null
}) {
  return (
    <section className="aios-history" aria-label="History and advanced analytics">
      <button type="button" className="aios-history-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="aios-kicker">History · Advanced</span>
        <span className="aios-history-chevron" data-open={open ? 'true' : 'false'} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="aios-history-body">
          {!summary || !holdings ? (
            <p className="aios-muted">Connect a wallet to load holdings analytics.</p>
          ) : (
            <>
              <p className="aios-muted">{summary.healthWhy}</p>
              <p className="aios-muted">{summary.stabilityWhy}</p>
              <dl className="aios-history-stats">
                <div>
                  <dt>Diversification</dt>
                  <dd>{summary.diversificationScore}/100</dd>
                </div>
                <div>
                  <dt>Stability</dt>
                  <dd>{summary.stabilityScore}/100</dd>
                </div>
                <div>
                  <dt>Holdings</dt>
                  <dd>{holdings.holdings.length}</dd>
                </div>
              </dl>
              <ul className="aios-history-list">
                {holdings.holdings.slice(0, 8).map((h) => (
                  <li key={h.mint}>
                    <span>${h.symbol}</span>
                    <span>{formatUsd(h.valueUsd)}</span>
                    <span data-tone={(h.change24hPct ?? 0) >= 0 ? 'up' : 'down'}>
                      {formatPct(h.change24hPct)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="aios-compliance">Not financial advice · DYOR</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
