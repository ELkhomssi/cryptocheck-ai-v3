"use client";

import {
  type PortfolioSummary,
  formatPortPct,
  formatPortUsd,
  formatPortUsdSigned,
} from "@/lib/trading-terminal/portfolio-intelligence";
import { AnimatedCounter } from "./AnimatedCounter";

export function PortfolioSummaryBar({ summary }: { summary: PortfolioSummary }) {
  const cells = [
    {
      label: "Total Portfolio Value",
      value: summary.totalValueUsd,
      format: (n: number) => formatPortUsd(n, false),
      tone: "neutral" as const,
    },
    {
      label: "Total PnL",
      value: summary.totalPnlUsd,
      format: (n: number) =>
        `${formatPortUsdSigned(n)} (${formatPortPct(summary.totalPnlPct)})`,
      tone: summary.totalPnlUsd >= 0 ? ("pos" as const) : ("neg" as const),
    },
    {
      label: "Portfolio Risk Score",
      value: summary.portfolioRiskScore,
      format: (n: number) => n.toFixed(0),
      tone:
        summary.portfolioRiskScore >= 60
          ? ("neg" as const)
          : summary.portfolioRiskScore >= 40
            ? ("warn" as const)
            : ("pos" as const),
    },
    {
      label: "Holdings",
      value: summary.holdingsCount,
      format: (n: number) => Math.round(n).toString(),
      tone: "neutral" as const,
    },
    {
      label: "Smart Money Alignment",
      value: summary.smartMoneyAlignment,
      format: (n: number) => n.toFixed(0),
      tone: "pos" as const,
    },
    {
      label: "Portfolio Health",
      value: summary.portfolioHealthScore,
      format: (n: number) => n.toFixed(0),
      tone: "pos" as const,
    },
  ];

  return (
    <section className="tit-port-summary" aria-label="Portfolio summary">
      <div className="tit-port-summary-head">
        <p className="tit-eyebrow">Summary</p>
        {summary.sample ? <span className="tit-sample-tag">sample</span> : null}
      </div>
      <div className="tit-port-summary-grid">
        {cells.map((c) => (
          <div key={c.label} className={`tit-port-summary-cell tone-${c.tone}`}>
            <p className="tit-port-summary-label">{c.label}</p>
            <p className="tit-mono tit-port-summary-value">
              <AnimatedCounter value={c.value} format={c.format} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
