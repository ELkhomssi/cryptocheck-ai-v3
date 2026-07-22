"use client";

import {
  type AlphaTimelineEvent,
  formatAlphaTime,
} from "@/lib/trading-terminal/alpha-discovery";

export function AlphaTimeline({
  events,
  selectedMint,
  onSelectMint,
}: {
  events: AlphaTimelineEvent[];
  selectedMint: string | null;
  onSelectMint: (mint: string) => void;
}) {
  return (
    <section className="tit-alpha-timeline" aria-label="Opportunity timeline">
      <header className="tit-alpha-timeline-head">
        <div>
          <p className="tit-eyebrow">Chronology</p>
          <h2 className="tit-alpha-panel-title">Signal Timeline</h2>
        </div>
        <span className="tit-live-dot" aria-hidden />
      </header>

      <ol className="tit-alpha-timeline-list">
        {events.length === 0 ? (
          <li className="tit-alpha-empty">Awaiting chronological signal events</li>
        ) : (
          events.map((ev) => (
            <li
              key={ev.id}
              className={`tit-alpha-tl-item tone-${ev.tone}${
                selectedMint === ev.mint ? " is-linked" : ""
              }`}
            >
              <button type="button" className="tit-alpha-tl-btn" onClick={() => onSelectMint(ev.mint)}>
                <div className="tit-alpha-tl-row1">
                  <time className="tit-mono" dateTime={ev.at}>
                    {formatAlphaTime(ev.at)}
                  </time>
                  <span className="tit-alpha-tl-sym">{ev.symbol}</span>
                  {ev.sample ? <span className="tit-sample-tag">sample</span> : null}
                </div>
                <p className="tit-alpha-tl-title">{ev.title}</p>
                <p className="tit-alpha-tl-detail">{ev.detail}</p>
              </button>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
