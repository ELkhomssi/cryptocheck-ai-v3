'use client'

import type { ChartEvent } from '../types'

export function BottomTimeline({
  events,
  onJump,
  activeId,
}: {
  events: ChartEvent[]
  onJump: (ev: ChartEvent) => void
  activeId: string | null
}) {
  return (
    <div className="ic-timeline" aria-label="Event timeline">
      <div className="ic-timeline-head">Timeline</div>
      {events.length === 0 ? (
        <div className="ic-timeline-empty">No events for visible layers.</div>
      ) : (
        <ul className="ic-timeline-list">
          {events.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                className="ic-timeline-item"
                data-active={activeId === ev.id}
                data-severity={ev.severity}
                onClick={() => onJump(ev)}
              >
                <span className="ic-timeline-time">
                  {new Date(ev.timestamp * 1000).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="ic-timeline-label">{ev.label}</span>
                <span className="ic-timeline-layer">{ev.layerId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
