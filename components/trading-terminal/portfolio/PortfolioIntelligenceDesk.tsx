"use client";

import { useMemo, useState } from "react";
import {
  type PortfolioHolding,
  buildPortfolioIntelligence,
} from "@/lib/trading-terminal/portfolio-intelligence";
import type { TerminalDataMode } from "@/lib/trading-terminal/data/types";
import { PortfolioSummaryBar } from "./PortfolioSummaryBar";
import { PortfolioOverview } from "./PortfolioOverview";
import { PortfolioRiskPanel } from "./PortfolioRiskPanel";
import { PortfolioAlignmentPanel } from "./PortfolioAlignmentPanel";
import { PortfolioHiddenRiskPanel } from "./PortfolioHiddenRiskPanel";
import { PortfolioInsightsPanel } from "./PortfolioInsightsPanel";
import { PortfolioWatchlistPanel } from "./PortfolioWatchlistPanel";

export function PortfolioIntelligenceDesk({
  mode,
  watchedMints,
  onFocusMint,
  onToggleWatchlist,
}: {
  mode: TerminalDataMode;
  watchedMints: Set<string>;
  onFocusMint: (mint: string, symbol: string) => void;
  onToggleWatchlist: (holding: PortfolioHolding, currentlyWatched: boolean) => void;
}) {
  const bundle = useMemo(() => buildPortfolioIntelligence(mode), [mode]);
  const [alertMints, setAlertMints] = useState<Set<string>>(() => new Set());

  const onToggleAlert = (mint: string) => {
    setAlertMints((prev) => {
      const next = new Set(prev);
      if (next.has(mint)) next.delete(mint);
      else next.add(mint);
      return next;
    });
  };

  return (
    <div className="tit-port-desk" data-mode={mode}>
      <header className="tit-port-desk-banner">
        <div>
          <p className="tit-eyebrow">Institutional module</p>
          <h1 className="tit-port-desk-title">Portfolio Intelligence</h1>
        </div>
        <p className="tit-port-desk-sub">
          Risk · exposure · liquidity · whale alignment · health
        </p>
        {bundle.sample ? (
          <span className="tit-sample-tag" title="Demo portfolio intelligence desk">
            sample
          </span>
        ) : (
          <span className="tit-port-live-badge">live · awaiting wallet</span>
        )}
        <span className="tit-mono tit-port-method">{bundle.methodNote}</span>
      </header>

      {bundle.liveNote ? <p className="tit-port-live-note">{bundle.liveNote}</p> : null}

      <PortfolioSummaryBar summary={bundle.summary} />

      <div className="tit-port-desk-grid">
        <PortfolioOverview allocations={bundle.allocations} sample={bundle.sample} />
        <PortfolioRiskPanel risk={bundle.risk} />
        <PortfolioAlignmentPanel alignment={bundle.alignment} />
        <PortfolioHiddenRiskPanel
          findings={bundle.hiddenRisks}
          onSelectMint={(mint) => {
            const h = bundle.holdings.find((x) => x.mint === mint);
            if (h) onFocusMint(h.mint, h.symbol);
          }}
        />
        <PortfolioInsightsPanel insights={bundle.insights} />
        <PortfolioWatchlistPanel
          holdings={bundle.holdings}
          watchedMints={watchedMints}
          alertMints={alertMints}
          onToggleWatch={(h) => onToggleWatchlist(h, watchedMints.has(h.mint))}
          onToggleAlert={onToggleAlert}
          onSelectMint={onFocusMint}
        />
      </div>
    </div>
  );
}
