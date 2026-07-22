"use client";

import type { PortfolioAiInsights } from "@/lib/trading-terminal/portfolio-intelligence";

export function PortfolioInsightsPanel({ insights }: { insights: PortfolioAiInsights }) {
  return (
    <section className="tit-port-insights" aria-label="AI portfolio insights">
      <header className="tit-port-panel-head">
        <div>
          <p className="tit-eyebrow">AI insights</p>
          <h2 className="tit-port-panel-title">Portfolio Reasoning</h2>
        </div>
        {insights.sample ? <span className="tit-sample-tag">sample</span> : null}
        <span className={`tit-port-health health-${insights.healthLabel.toLowerCase()}`}>
          Health: {insights.healthLabel}
        </span>
      </header>

      <div className="tit-port-insights-grid">
        <div className="tit-port-insights-block tone-pos">
          <h3>Strengths</h3>
          <ul>
            {(insights.strengths.length ? insights.strengths : ["—"]).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="tit-port-insights-block tone-warn">
          <h3>Risks</h3>
          <ul>
            {(insights.risks.length ? insights.risks : ["—"]).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="tit-port-insights-block tone-action">
          <h3>Suggested Actions</h3>
          <ul>
            {insights.suggestedActions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
