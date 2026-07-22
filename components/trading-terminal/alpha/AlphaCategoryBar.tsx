"use client";

import type { AlphaCategoryId } from "@/lib/trading-terminal/alpha-discovery";

export function AlphaCategoryBar({
  categories,
  active,
  onSelect,
  sample,
}: {
  categories: Array<{ id: AlphaCategoryId; label: string; count: number }>;
  active: AlphaCategoryId | "all";
  onSelect: (id: AlphaCategoryId | "all") => void;
  sample: boolean;
}) {
  return (
    <section className="tit-alpha-cats" aria-label="Opportunity categories">
      <div className="tit-alpha-cats-head">
        <p className="tit-eyebrow">Opportunity categories</p>
        {sample ? <span className="tit-sample-tag">sample</span> : null}
      </div>
      <div className="tit-alpha-cats-row" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === "all"}
          className={`tit-alpha-cat${active === "all" ? " is-active" : ""}`}
          onClick={() => onSelect("all")}
        >
          <span className="tit-alpha-cat-label">All Signals</span>
          <span className="tit-mono tit-alpha-cat-count">
            {categories.reduce((a, c) => a + c.count, 0)}
          </span>
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active === c.id}
            className={`tit-alpha-cat${active === c.id ? " is-active" : ""}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="tit-alpha-cat-label">{c.label}</span>
            <span className="tit-mono tit-alpha-cat-count">{c.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
