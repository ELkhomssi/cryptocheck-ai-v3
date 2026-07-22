"use client";

import type { AlphaReasoning } from "@/lib/trading-terminal/alpha-discovery";

function Meter({ label, value }: { label: string; value: number }) {
  const tone = value >= 75 ? "pos" : value >= 55 ? "warn" : "neg";
  return (
    <div className={`tit-alpha-meter tone-${tone}`}>
      <div className="tit-alpha-meter-head">
        <span>{label}</span>
        <span className="tit-mono">{value.toFixed(0)}</span>
      </div>
      <div className="tit-alpha-meter-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function AlphaReasoningPanel({ reasoning }: { reasoning: AlphaReasoning | null }) {
  if (!reasoning) {
    return (
      <aside className="tit-alpha-reason" aria-label="AI reasoning">
        <header className="tit-alpha-reason-head">
          <div>
            <p className="tit-eyebrow">AI reasoning</p>
            <h2 className="tit-alpha-panel-title">Opportunity Brief</h2>
          </div>
        </header>
        <p className="tit-alpha-empty">Select a token to load alpha reasoning</p>
      </aside>
    );
  }

  return (
    <aside className="tit-alpha-reason" aria-label="AI reasoning">
      <header className="tit-alpha-reason-head">
        <div>
          <p className="tit-eyebrow">AI reasoning</p>
          <h2 className="tit-alpha-panel-title">{reasoning.symbol}</h2>
        </div>
        {reasoning.sample ? <span className="tit-sample-tag">sample</span> : null}
      </header>

      <div className="tit-alpha-reason-meters">
        <Meter label="Alpha Score" value={reasoning.alphaScore} />
        <Meter label="Confidence" value={reasoning.confidence} />
      </div>

      <section className="tit-alpha-reason-block">
        <h3>Evidence</h3>
        <ul>
          {reasoning.evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>

      <section className="tit-alpha-reason-block tone-risk">
        <h3>Risk Factors</h3>
        <ul>
          {reasoning.riskFactors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>

      <section className="tit-alpha-reason-block tone-drive">
        <h3>Opportunity Drivers</h3>
        <ul>
          {reasoning.opportunityDrivers.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
