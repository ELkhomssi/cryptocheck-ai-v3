"use client";

import type { WhaleConsensusMetrics } from "@/lib/trading-terminal/whale-intelligence";

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "pos" | "neg" | "warn" | "neutral";
}) {
  const t = tone ?? (value >= 65 ? "pos" : value >= 40 ? "warn" : "neg");
  return (
    <div className={`tit-whale-meter tone-${t}`}>
      <div className="tit-whale-meter-head">
        <span>{label}</span>
        <span className="tit-mono">{value.toFixed(0)}</span>
      </div>
      <div className="tit-whale-meter-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function WhaleConsensusEngine({ consensus }: { consensus: WhaleConsensusMetrics }) {
  return (
    <section className="tit-whale-consensus" aria-label="Whale consensus engine">
      <header className="tit-whale-consensus-head">
        <div>
          <p className="tit-eyebrow">Consensus</p>
          <h2 className="tit-whale-consensus-title">Whale Consensus Engine</h2>
        </div>
        <span className={`tit-whale-bias bias-${consensus.bias}`}>{consensus.bias}</span>
        {consensus.sample ? (
          <span className="tit-sample-tag" title="Demo consensus scores">
            sample
          </span>
        ) : null}
      </header>

      <div className="tit-whale-consensus-grid">
        <Meter label="Smart Money Score" value={consensus.smartMoneyScore} tone="pos" />
        <Meter label="Whale Conviction" value={consensus.whaleConviction} tone="pos" />
        <Meter label="Insider Risk" value={consensus.insiderRisk} tone="warn" />
        <Meter label="Distribution Probability" value={consensus.distributionProbability} tone="neg" />
        <Meter label="Market Influence" value={consensus.marketInfluence} tone="neutral" />
        <Meter label="Confidence" value={consensus.confidence} tone="pos" />
      </div>

      <p className="tit-whale-consensus-note">{consensus.summary}</p>
    </section>
  );
}
