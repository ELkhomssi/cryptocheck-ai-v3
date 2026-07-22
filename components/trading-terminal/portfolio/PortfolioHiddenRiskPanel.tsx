"use client";

import type { HiddenRiskFinding } from "@/lib/trading-terminal/portfolio-intelligence";

export function PortfolioHiddenRiskPanel({
  findings,
  onSelectMint,
}: {
  findings: HiddenRiskFinding[];
  onSelectMint?: (mint: string) => void;
}) {
  return (
    <section className="tit-port-hidden" aria-label="Hidden risk detector">
      <header className="tit-port-panel-head">
        <div>
          <p className="tit-eyebrow">Detector</p>
          <h2 className="tit-port-panel-title">Hidden Risk</h2>
        </div>
        {findings.some((f) => f.sample) ? <span className="tit-sample-tag">sample</span> : null}
      </header>

      <ul className="tit-port-hidden-list">
        {findings.length === 0 ? (
          <li className="tit-port-empty">No hidden-risk findings — connect wallet for live scan</li>
        ) : (
          findings.map((f) => (
            <li key={f.id} className={`tit-port-hidden-item sev-${f.severity}`}>
              <div className="tit-port-hidden-row1">
                <span className={`tit-port-sev sev-${f.severity}`}>{f.severity}</span>
                {f.symbol ? <span className="tit-port-hidden-sym">{f.symbol}</span> : null}
                {f.sample ? <span className="tit-sample-tag">sample</span> : null}
              </div>
              <button
                type="button"
                className="tit-port-hidden-title"
                disabled={!f.mint}
                onClick={() => f.mint && onSelectMint?.(f.mint)}
              >
                {f.title}
              </button>
              <p className="tit-port-hidden-detail">{f.detail}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
