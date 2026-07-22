"use client";

import { useState } from "react";
import {
  type AllocationKind,
  type PortfolioAllocations,
  formatPortUsd,
} from "@/lib/trading-terminal/portfolio-intelligence";

const TABS: Array<{ id: AllocationKind; label: string }> = [
  { id: "asset", label: "Asset Allocation" },
  { id: "sector", label: "Sector Allocation" },
  { id: "risk", label: "Risk Allocation" },
  { id: "liquidity", label: "Liquidity Allocation" },
];

export function PortfolioOverview({
  allocations,
  sample,
}: {
  allocations: PortfolioAllocations;
  sample: boolean;
}) {
  const [tab, setTab] = useState<AllocationKind>("sector");
  const slices = allocations[tab];

  return (
    <section className="tit-port-overview" aria-label="Portfolio overview">
      <header className="tit-port-panel-head">
        <div>
          <p className="tit-eyebrow">Overview</p>
          <h2 className="tit-port-panel-title">Portfolio Composition</h2>
        </div>
        {sample ? <span className="tit-sample-tag">sample</span> : null}
      </header>

      <div className="tit-port-alloc-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tit-port-alloc-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {slices.length === 0 ? (
        <p className="tit-port-empty">Awaiting portfolio allocation data</p>
      ) : (
        <div className="tit-port-alloc-body">
          <div className="tit-port-alloc-stack" aria-hidden>
            {slices.map((s) => (
              <span
                key={s.id}
                className={`tit-port-alloc-seg tone-${s.tone ?? "neutral"}`}
                style={{ width: `${Math.max(2, s.pct)}%` }}
                title={`${s.label} ${s.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <ul className="tit-port-alloc-list">
            {slices.map((s) => (
              <li key={s.id} className="tit-port-alloc-row">
                <span className={`tit-port-dot tone-${s.tone ?? "neutral"}`} />
                <span className="tit-port-alloc-label">{s.label}</span>
                <span className="tit-mono tit-port-alloc-pct">{s.pct.toFixed(1)}%</span>
                <span className="tit-mono tit-port-alloc-usd">{formatPortUsd(s.valueUsd)}</span>
                <span className="tit-port-alloc-bar">
                  <span style={{ width: `${Math.min(100, s.pct)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
