'use client'

/**
 * Mission Feed — chronological intelligence timeline.
 * Reuses intelligence-core timeline events — never invents activity.
 */

import { formatTimelineClock, timelineHeadline } from '@/lib/portfolio-desk/mission-narrative'
import type { TimelineEvent } from '@/types/intelligence-core'

export function MissionFeed({
  events,
  loading,
}: {
  events: TimelineEvent[]
  loading: boolean
}) {
  return (
    <section className="aios-feed" aria-label="Mission Feed">
      <div className="aios-feed-head">
        <p className="aios-kicker">Mission Feed</p>
        <h2 className="aios-section-title">Live timeline</h2>
      </div>

      {loading ? (
        <div className="aios-timeline">
          <div className="aios-skeleton" />
          <div className="aios-skeleton" />
          <div className="aios-skeleton" />
        </div>
      ) : null}

      {!loading && events.length === 0 ? (
        <p className="aios-muted">Quiet so far — engines are monitoring. No fabricated activity.</p>
      ) : null}

      {!loading && events.length > 0 ? (
        <ol className="aios-timeline">
          {events.slice(0, 24).map((ev, i) => (
            <li key={ev.id} className="aios-timeline-item" data-latest={i === 0 ? 'true' : 'false'}>
              <time dateTime={ev.createdAt}>{formatTimelineClock(ev.createdAt)}</time>
              <div className="aios-timeline-body">
                <strong>{timelineHeadline(ev)}</strong>
                {ev.module ? <span className="aios-timeline-mod">{ev.module}</span> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
