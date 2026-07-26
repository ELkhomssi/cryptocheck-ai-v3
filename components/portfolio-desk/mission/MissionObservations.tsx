'use client'

/**
 * Phase 17.1 — right-rail observations (explanation, not raw numbers).
 */

import type { Observation } from '@/lib/portfolio-desk/mission-narrative'

export function MissionObservations({
  observations,
  loading,
}: {
  observations: Observation[]
  loading?: boolean
}) {
  return (
    <section className="mc-observations">
      <div className="mc-kicker">Observations</div>
      <h2 className="mc-aside-title">What the system sees</h2>
      {loading ? (
        <div className="pd-skeleton" style={{ height: 120, marginTop: 12 }} />
      ) : (
        <ul className="mc-obs-list">
          {observations.map((o) => (
            <li key={o.id}>{o.text}</li>
          ))}
        </ul>
      )}
      <p className="mc-aside-footnote">
        Observations are derived from live mission, module, and portfolio feeds — never decorative.
      </p>
    </section>
  )
}
