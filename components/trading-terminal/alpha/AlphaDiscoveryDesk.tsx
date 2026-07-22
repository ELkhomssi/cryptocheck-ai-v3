"use client";

import { useMemo, useState } from "react";
import {
  type AlphaCategoryId,
  type AlphaSectorId,
  type AlphaSortKey,
  buildAlphaDiscovery,
  sortAlphaRows,
} from "@/lib/trading-terminal/alpha-discovery";
import type { TerminalDataMode } from "@/lib/trading-terminal/data/types";
import { AlphaCategoryBar } from "./AlphaCategoryBar";
import { AlphaOpportunityTable } from "./AlphaOpportunityTable";
import { AlphaReasoningPanel } from "./AlphaReasoningPanel";
import { AlphaNarrativePanel } from "./AlphaNarrativePanel";
import { AlphaTimeline } from "./AlphaTimeline";

export function AlphaDiscoveryDesk({
  mode,
  onFocusMint,
}: {
  mode: TerminalDataMode;
  onFocusMint?: (mint: string, symbol: string) => void;
}) {
  const bundle = useMemo(() => buildAlphaDiscovery(mode), [mode]);
  const [category, setCategory] = useState<AlphaCategoryId | "all">("all");
  const [sector, setSector] = useState<AlphaSectorId | null>(null);
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<AlphaSortKey>("alphaScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedMint, setSelectedMint] = useState<string | null>(
    bundle.opportunities[0]?.mint ?? null,
  );

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let rows = bundle.opportunities;
    if (category !== "all") rows = rows.filter((r) => r.category === category);
    if (sector) rows = rows.filter((r) => r.sector === sector);
    if (q) {
      rows = rows.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.sector.toLowerCase().includes(q) ||
          r.category.includes(q),
      );
    }
    return sortAlphaRows(rows, sortKey, sortDir);
  }, [bundle.opportunities, category, sector, filterText, sortKey, sortDir]);

  const timeline = useMemo(() => {
    if (!selectedMint) return bundle.timeline;
    const focused = bundle.timeline.filter((e) => e.mint === selectedMint);
    return focused.length > 0 ? focused : bundle.timeline;
  }, [bundle.timeline, selectedMint]);

  const reasoning = selectedMint ? bundle.reasoningByMint[selectedMint] ?? null : null;
  const selectedRow = bundle.opportunities.find((r) => r.mint === selectedMint) ?? null;

  const onSort = (key: AlphaSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "symbol" || key === "riskScore" ? "asc" : "desc");
    }
  };

  const onSelect = (mint: string) => {
    setSelectedMint(mint);
    const row = bundle.opportunities.find((r) => r.mint === mint);
    if (row && onFocusMint) onFocusMint(row.mint, row.symbol);
  };

  return (
    <div className="tit-alpha-desk" data-mode={mode}>
      <header className="tit-alpha-desk-banner">
        <div>
          <p className="tit-eyebrow">Institutional module</p>
          <h1 className="tit-alpha-desk-title">Alpha Discovery</h1>
        </div>
        <p className="tit-alpha-desk-sub">
          Opportunity intelligence · before the broader market
        </p>
        {bundle.sample ? (
          <span className="tit-sample-tag" title="Demo alpha discovery desk">
            sample
          </span>
        ) : (
          <span className="tit-alpha-live-badge">live · awaiting feeds</span>
        )}
        <span className="tit-mono tit-alpha-method">{bundle.methodNote}</span>
        {selectedRow ? (
          <span className="tit-mono tit-alpha-focus">
            Focus {selectedRow.symbol} · α {selectedRow.alphaScore}
          </span>
        ) : null}
      </header>

      <AlphaCategoryBar
        categories={bundle.categories}
        active={category}
        onSelect={setCategory}
        sample={bundle.sample}
      />

      <div className="tit-alpha-desk-grid">
        <AlphaOpportunityTable
          rows={filtered}
          selectedMint={selectedMint}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          onSelect={onSelect}
          filterText={filterText}
          onFilterText={setFilterText}
        />
        <AlphaReasoningPanel reasoning={reasoning} />
        <AlphaNarrativePanel
          narratives={bundle.narratives}
          activeSector={sector}
          onSelectSector={setSector}
          sample={bundle.sample}
        />
        <AlphaTimeline
          events={timeline}
          selectedMint={selectedMint}
          onSelectMint={onSelect}
        />
      </div>
    </div>
  );
}
