"use client";

import type { AlphaNarrativeSector, AlphaSectorId } from "@/lib/trading-terminal/alpha-discovery";

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="tit-alpha-narr-metric">
      <div className="tit-alpha-narr-metric-head">
        <span>{label}</span>
        <span className="tit-mono">{value.toFixed(0)}</span>
      </div>
      <div className="tit-alpha-narr-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function AlphaNarrativePanel({
  narratives,
  activeSector,
  onSelectSector,
  sample,
}: {
  narratives: AlphaNarrativeSector[];
  activeSector: AlphaSectorId | null;
  onSelectSector: (id: AlphaSectorId | null) => void;
  sample: boolean;
}) {
  return (
    <section className="tit-alpha-narrative" aria-label="Narrative intelligence">
      <header className="tit-alpha-narrative-head">
        <div>
          <p className="tit-eyebrow">Sectors</p>
          <h2 className="tit-alpha-panel-title">Narrative Intelligence</h2>
        </div>
        {sample ? <span className="tit-sample-tag">sample</span> : null}
        {activeSector ? (
          <button type="button" className="tit-alpha-clear" onClick={() => onSelectSector(null)}>
            Clear sector
          </button>
        ) : null}
      </header>

      <div className="tit-alpha-narr-grid">
        {narratives.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`tit-alpha-narr-card bias-${n.bias}${activeSector === n.id ? " is-active" : ""}`}
            onClick={() => onSelectSector(activeSector === n.id ? null : n.id)}
          >
            <div className="tit-alpha-narr-card-top">
              <span className="tit-alpha-narr-id">{n.id}</span>
              <span className={`tit-alpha-narr-bias bias-${n.bias}`}>{n.bias}</span>
            </div>
            <MiniBar label="Liquidity Flow" value={n.liquidityFlow} />
            <MiniBar label="Whale Activity" value={n.whaleActivity} />
            <MiniBar label="Momentum" value={n.momentum} />
            <MiniBar label="Narrative Strength" value={n.narrativeStrength} />
          </button>
        ))}
      </div>
    </section>
  );
}
