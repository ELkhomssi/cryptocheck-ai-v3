"use client";

import {
  type AlphaOpportunityRow,
  type AlphaSortKey,
  formatAlphaPct,
} from "@/lib/trading-terminal/alpha-discovery";

const COLUMNS: Array<{ key: AlphaSortKey; label: string }> = [
  { key: "symbol", label: "Token" },
  { key: "alphaScore", label: "Alpha" },
  { key: "riskScore", label: "Risk" },
  { key: "smartMoneyScore", label: "Smart $" },
  { key: "liquidityGrowthPct", label: "Liq Δ" },
  { key: "holderQuality", label: "Holders" },
  { key: "conviction", label: "Convict." },
];

function ScoreCell({ value, invert }: { value: number; invert?: boolean }) {
  const tone = invert
    ? value >= 60
      ? "neg"
      : value >= 40
        ? "warn"
        : "pos"
    : value >= 75
      ? "pos"
      : value >= 55
        ? "warn"
        : "neg";
  return (
    <td>
      <div className={`tit-alpha-score tone-${tone}`}>
        <span className="tit-mono">{value.toFixed(0)}</span>
        <span className="tit-alpha-score-bar" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </td>
  );
}

export function AlphaOpportunityTable({
  rows,
  selectedMint,
  sortKey,
  sortDir,
  onSort,
  onSelect,
  filterText,
  onFilterText,
}: {
  rows: AlphaOpportunityRow[];
  selectedMint: string | null;
  sortKey: AlphaSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: AlphaSortKey) => void;
  onSelect: (mint: string) => void;
  filterText: string;
  onFilterText: (v: string) => void;
}) {
  return (
    <section className="tit-alpha-table-panel" aria-label="Alpha opportunity table">
      <header className="tit-alpha-table-head">
        <div>
          <p className="tit-eyebrow">Main book</p>
          <h2 className="tit-alpha-panel-title">Opportunity Intelligence</h2>
        </div>
        <label className="tit-alpha-filter">
          <input
            className="tit-input"
            value={filterText}
            onChange={(e) => onFilterText(e.target.value)}
            placeholder="Filter symbol / sector…"
            aria-label="Filter tokens"
          />
        </label>
      </header>

      <div className="tit-alpha-table-wrap">
        <table className="tit-alpha-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key}>
                  <button
                    type="button"
                    className={`tit-alpha-sort${sortKey === col.key ? " is-active" : ""}`}
                    onClick={() => onSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="tit-alpha-empty">
                  No opportunities match filters
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={`tit-alpha-row${selectedMint === r.mint ? " is-selected" : ""}`}
                  onClick={() => onSelect(r.mint)}
                >
                  <td>
                    <div className="tit-alpha-token-cell">
                      <span className="tit-alpha-token-sym">{r.symbol}</span>
                      <span className="tit-alpha-token-meta">
                        {r.sector} · {formatAlphaPct(r.changePct)}
                        {r.sample ? <span className="tit-sample-tag">sample</span> : null}
                      </span>
                    </div>
                  </td>
                  <ScoreCell value={r.alphaScore} />
                  <ScoreCell value={r.riskScore} invert />
                  <ScoreCell value={r.smartMoneyScore} />
                  <td className={`tit-mono ${r.liquidityGrowthPct >= 0 ? "tit-alpha-pos" : "tit-alpha-neg"}`}>
                    {formatAlphaPct(r.liquidityGrowthPct)}
                  </td>
                  <ScoreCell value={r.holderQuality} />
                  <ScoreCell value={r.conviction} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
