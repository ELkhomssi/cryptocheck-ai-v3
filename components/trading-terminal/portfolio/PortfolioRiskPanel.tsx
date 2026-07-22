"use client";

import type { PortfolioRiskAnalysis } from "@/lib/trading-terminal/portfolio-intelligence";

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "pos" | "neg" | "warn" | "neutral";
}) {
  const t = tone ?? (value >= 60 ? "neg" : value >= 40 ? "warn" : "pos");
  return (
    <div className={`tit-port-meter tone-${t}`}>
      <div className="tit-port-meter-head">
        <span>{label}</span>
        <span className="tit-mono">{value.toFixed(0)}</span>
      </div>
      <div className="tit-port-meter-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function PortfolioRiskPanel({ risk }: { risk: PortfolioRiskAnalysis }) {
  return (
    <section className="tit-port-risk" aria-label="Risk analysis">
      <header className="tit-port-panel-head">
        <div>
          <p className="tit-eyebrow">Risk analysis</p>
          <h2 className="tit-port-panel-title">Portfolio Risk</h2>
        </div>
        {risk.sample ? <span className="tit-sample-tag">sample</span> : null}
        <span className="tit-mono tit-port-risk-score">{risk.portfolioRiskScore}</span>
      </header>

      <div className="tit-port-risk-bands">
        <div className="tit-port-band tone-neg">
          <span className="tit-mono">{risk.highRiskHoldings}</span>
          <span>High Risk</span>
        </div>
        <div className="tit-port-band tone-warn">
          <span className="tit-mono">{risk.mediumRiskHoldings}</span>
          <span>Medium Risk</span>
        </div>
        <div className="tit-port-band tone-pos">
          <span className="tit-mono">{risk.lowRiskHoldings}</span>
          <span>Low Risk</span>
        </div>
      </div>

      <div className="tit-port-risk-meters">
        <Meter label="Rug Exposure" value={risk.rugExposure} tone="neg" />
        <Meter label="Concentration Risk" value={risk.concentrationRisk} tone="warn" />
        <Meter label="Liquidity Risk" value={risk.liquidityRisk} tone="warn" />
        <Meter label="Portfolio Risk Score" value={risk.portfolioRiskScore} />
      </div>
      <p className="tit-port-note">{risk.note}</p>
    </section>
  );
}
