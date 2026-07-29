'use client'

import type { IntelligenceSidebarState } from '../types'

function Metric({
  label,
  value,
  empty,
}: {
  label: string
  value: string | number | null | undefined
  empty?: boolean
}) {
  return (
    <div className="ic-side-metric" data-empty={empty || value == null}>
      <div className="ic-side-label">{label}</div>
      <div className="ic-side-value">{value == null ? '—' : value}</div>
    </div>
  )
}

export function IntelligenceSidebar({
  state,
  symbol,
  live,
}: {
  state: IntelligenceSidebarState | null
  symbol: string
  live: boolean
}) {
  return (
    <aside className="ic-sidebar" aria-label="Intelligence at scrubber">
      <header className="ic-sidebar-head">
        <span>${symbol}</span>
        <span className="ic-sidebar-mode">{live ? 'LIVE' : 'REPLAY'}</span>
      </header>
      <Metric label="AI Conviction" value={state?.aiConviction ?? null} />
      <Metric label="Risk" value={state?.risk ?? null} />
      <Metric label="Confidence" value={state?.confidence ?? null} />
      <Metric label="Trend" value={state?.trend ?? null} />
      <Metric label="Smart Money" value={state?.smartMoneyActivity ?? null} />
      <Metric
        label="Whale Pressure"
        value={state?.whalePressure ? state.whalePressure : null}
      />
      <Metric
        label="Holder Health"
        value={state?.holderHealth ?? null}
        empty={state?.holderHealth == null}
      />
      <div className="ic-side-narrative">
        <div className="ic-side-label">Narrative</div>
        <p>{state?.narrative || 'No narrative at this timestamp.'}</p>
      </div>
    </aside>
  )
}
