'use client'

import { formatPct } from '@/features/terminal-os/shared/lib/format'
import type { TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'

function holdLabel(ms: number): string {
  if (!ms || ms <= 0) return '—'
  const h = ms / 3_600_000
  if (h < 1) return `${Math.round(ms / 60_000)}m`
  if (h < 48) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

export function TraderDnaDashboard({ dna }: { dna: TraderDna }) {
  return (
    <div className="tos-tlm-dna">
      <header className="tos-tlm-dna-head">
        <div>
          <p className="tos-tlm-kicker">Trader DNA</p>
          <h3 className="tos-tlm-dna-title">{dna.tradingStyleSummary}</h3>
        </div>
        {dna.sample ? <span className="tos-wm-sample">sample</span> : null}
      </header>

      <div className="tos-tlm-dna-grid">
        <Metric label="Risk appetite" value={dna.riskAppetite} />
        <Metric label="Win rate" value={`${dna.winRatePct}%`} />
        <Metric label="Avg ROI" value={formatPct(dna.avgRoiPct)} />
        <Metric label="Loss tolerance" value={`${dna.lossTolerancePct}%`} />
        <Metric label="Avg hold" value={holdLabel(dna.avgHoldingMs)} />
        <Metric label="Discipline" value={`${dna.disciplineScore}`} />
        <Metric label="Emotional bias" value={`${dna.emotionalBiasScore}`} />
        <Metric label="Confidence" value={`${dna.confidenceScore}%`} />
      </div>

      <div className="tos-tlm-dna-section">
        <h4>Favorite chains</h4>
        <div className="tos-tlm-chips">
          {dna.favoriteChains.map((c) => (
            <span key={c.chain} className="tos-tlm-chip">
              {c.chain} {c.weight}%
            </span>
          ))}
        </div>
      </div>

      <div className="tos-tlm-dna-section">
        <h4>Sectors</h4>
        <div className="tos-tlm-chips">
          {dna.favoriteSectors.map((s) => (
            <span key={s} className="tos-tlm-chip">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="tos-tlm-dna-cols">
        <div>
          <h4>Typical entry</h4>
          <ul>
            {dna.typicalEntry.map((e) => (
              <li key={e.label}>
                <strong>{e.label}</strong>
                <span className="tos-muted">{e.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Typical exit</h4>
          <ul>
            {dna.typicalExit.map((e) => (
              <li key={e.label}>
                <strong>{e.label}</strong>
                <span className="tos-muted">{e.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="tos-muted tos-tlm-dna-foot">
        {dna.tradeCount} trades analyzed · updated {new Date(dna.updatedAt).toLocaleString()} · Not
        financial advice
      </p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="tos-tlm-metric">
      <span className="tos-tlm-metric-label">{label}</span>
      <span className="tos-tlm-metric-value">{value}</span>
    </div>
  )
}