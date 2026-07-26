'use client'

/**
 * Right-rail observations — quiet notes, not a second dashboard.
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
      <div className="mc-kicker">Listening</div>
      <h2 className="mc-aside-title">What I see</h2>
      {loading ? (
        <div className="pd-skeleton" style={{ height: 100, marginTop: 12 }} />
      ) : (
        <ul className="mc-obs-list">
          {observations.map((o) => (
            <li key={o.id}>{o.text}</li>
          ))}
        </ul>
      )}
      <p className="mc-aside-footnote">From live mission feeds — never decorative.</p>
    </section>
  )
}
