"use client";

import type { SmartMoneyAlignment } from "@/lib/trading-terminal/portfolio-intelligence";

export function PortfolioAlignmentPanel({ alignment }: { alignment: SmartMoneyAlignment }) {
  return (
    <section className="tit-port-align" aria-label="Smart money alignment">
      <header className="tit-port-panel-head">
        <div>
          <p className="tit-eyebrow">Smart money</p>
          <h2 className="tit-port-panel-title">Alignment</h2>
        </div>
        {alignment.sample ? <span className="tit-sample-tag">sample</span> : null}
      </header>

      <div className="tit-port-align-scores">
        <div>
          <p className="tit-port-summary-label">Alignment Score</p>
          <p className="tit-mono tit-port-align-big">{alignment.alignmentScore}</p>
        </div>
        <div>
          <p className="tit-port-summary-label">Whale Overlap</p>
          <p className="tit-mono tit-port-align-big">{alignment.whaleOverlap}</p>
        </div>
      </div>

      <div className="tit-port-align-block">
        <h3>Shared Holdings</h3>
        {alignment.sharedHoldings.length === 0 ? (
          <p className="tit-port-empty-inline">No shared holdings</p>
        ) : (
          <ul>
            {alignment.sharedHoldings.map((h) => (
              <li key={h.mint}>
                <span>{h.symbol}</span>
                <span className="tit-mono">{h.overlapPct}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="tit-port-align-block">
        <h3>Shared Narratives</h3>
        <div className="tit-port-narr-chips">
          {alignment.sharedNarratives.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
      <p className="tit-port-note">{alignment.note}</p>
    </section>
  );
}
