'use client'

import type { OsMarketSignal } from '../types'

export function MarketIntelligence({ signals }: { signals: OsMarketSignal[] }) {
  return (
    <section className="aios-section" data-delay="2" aria-label="Market Intelligence">
      <p className="aios-section-label">Market Intelligence</p>
      <div className="aios-market">
        {signals.map((s) => (
          <div
            key={s.id}
            className="aios-market-cell"
            data-available={s.available ? 'true' : 'false'}
          >
            <span className="aios-market-label">{s.label}</span>
            <span className="aios-market-value">{s.available && s.value ? s.value : '—'}</span>
            <span className="aios-market-detail">
              {s.detail ?? (s.available ? '' : 'No data')}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
