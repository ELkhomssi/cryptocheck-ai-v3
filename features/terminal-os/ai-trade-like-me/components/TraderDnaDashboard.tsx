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

/** Retention hook — confidence + sampleSize must be prominent */
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

      {/* Retention mechanic — cost of leaving */}
      <div className="tos-tlm-retention" aria-label="Learning investment">
        <div className="tos-tlm-retention-card">
          <span className="tos-tlm-retention-label">DNA Confidence</span>
          <span className="tos-tlm-retention-value tos-num">{dna.confidence}%</span>
          <div className="tos-tlm-retention-bar">
            <i style={{ width: `${dna.confidence}%` }} />
          </div>
          <p className="tos-tlm-retention-hint">Grows with every trade &amp; rejection — restarting elsewhere resets this.</p>
        </div>
        <div className="tos-tlm-retention-card">
          <span className="tos-tlm-retention-label">Sample Size</span>
          <span className="tos-tlm-retention-value tos-num">{dna.sampleSize}</span>
          <p className="tos-tlm-retention-meta">
            {dna.tradeCount} trades · {dna.rejectionCount} rejections
          </p>
          <p className="tos-tlm-retention-hint">Your edge includes what you walked away from.</p>
        </div>
      </div>

      <div className="tos-tlm-dna-grid">
        <Metric label="Risk appetite" value={`${dna.riskAppetite} · ${dna.riskAppetiteLabel}`} />
        <Metric label="Win rate" value={`${dna.winRatePct}%`} />
        <Metric label="Avg ROI" value={formatPct(dna.avgRoiPct)} />
        <Metric label="Loss tolerance" value={`${dna.lossTolerancePct}%`} />
        <Metric label="Avg hold" value={holdLabel(dna.avgHoldingMs)} />
        <Metric label="Discipline" value={`${dna.disciplineScore}`} />
        <Metric label="Emotional bias" value={`${dna.emotionalBiasScore}`} />
        <Metric label="Risk score" value={`${dna.riskAppetite}/100`} />
      </div>

      <div className="tos-tlm-dna-section">
        <h4>Favorite chains</h4>
        <div className="tos-tlm-chips">
          {dna.favoriteChains.map((c) => (
            <span key={c.tag} className="tos-tlm-chip">
              {c.tag} {c.weight}%
            </span>
          ))}
        </div>
      </div>

      <div className="tos-tlm-dna-section">
        <h4>Sectors</h4>
        <div className="tos-tlm-chips">
          {dna.favoriteSectors.map((s) => (
            <span key={s.tag} className="tos-tlm-chip">
              {s.tag} {s.weight}%
            </span>
          ))}
        </div>
      </div>

      <div className="tos-tlm-dna-cols">
        <div>
          <h4>Entry condition profile</h4>
          <ul>
            {dna.entryConditionProfile.map((e) => (
              <li key={e.label}>
                <strong>{e.label}</strong>
                <span className="tos-muted">{e.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Exit condition profile</h4>
          <ul>
            {dna.exitConditionProfile.map((e) => (
              <li key={e.label}>
                <strong>{e.label}</strong>
                <span className="tos-muted">{e.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
