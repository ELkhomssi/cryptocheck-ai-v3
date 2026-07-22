"use client";

import {
  type PortfolioHolding,
  formatPortPct,
  formatPortUsd,
  formatPortUsdSigned,
} from "@/lib/trading-terminal/portfolio-intelligence";

export function PortfolioWatchlistPanel({
  holdings,
  watchedMints,
  alertMints,
  onToggleWatch,
  onToggleAlert,
  onSelectMint,
}: {
  holdings: PortfolioHolding[];
  watchedMints: Set<string>;
  alertMints: Set<string>;
  onToggleWatch: (h: PortfolioHolding) => void;
  onToggleAlert: (mint: string) => void;
  onSelectMint: (mint: string, symbol: string) => void;
}) {
  return (
    <section className="tit-port-watch" aria-label="Watchlist integration">
      <header className="tit-port-panel-head">
        <div>
          <p className="tit-eyebrow">Integration</p>
          <h2 className="tit-port-panel-title">Holdings · Watchlist · Alerts</h2>
        </div>
        {holdings.some((h) => h.sample) ? <span className="tit-sample-tag">sample</span> : null}
      </header>

      <div className="tit-port-watch-wrap">
        <table className="tit-port-watch-table">
          <thead>
            <tr>
              <th>Holding</th>
              <th>Value</th>
              <th>PnL</th>
              <th>Risk</th>
              <th>Watch</th>
              <th>Alert</th>
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={6} className="tit-port-empty">
                  No holdings — connect wallet to track
                </td>
              </tr>
            ) : (
              holdings.map((h) => (
                <tr key={h.id} className="tit-port-watch-row">
                  <td>
                    <button
                      type="button"
                      className="tit-port-holding-btn"
                      onClick={() => onSelectMint(h.mint, h.symbol)}
                    >
                      <span className="tit-port-holding-sym">{h.symbol}</span>
                      <span className="tit-port-holding-meta">
                        {h.sector} · {h.weightPct.toFixed(1)}%
                      </span>
                    </button>
                  </td>
                  <td className="tit-mono">{formatPortUsd(h.valueUsd)}</td>
                  <td className={`tit-mono ${h.pnlUsd >= 0 ? "tit-port-pos" : "tit-port-neg"}`}>
                    {formatPortUsdSigned(h.pnlUsd)}
                    <span className="tit-port-pnl-pct"> {formatPortPct(h.pnlPct)}</span>
                  </td>
                  <td>
                    <span className={`tit-port-risk-chip band-${h.riskBand}`}>
                      {h.riskScore}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`tit-port-toggle${watchedMints.has(h.mint) ? " is-on" : ""}`}
                      onClick={() => onToggleWatch(h)}
                      aria-pressed={watchedMints.has(h.mint)}
                    >
                      {watchedMints.has(h.mint) ? "On" : "Add"}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`tit-port-toggle${alertMints.has(h.mint) ? " is-on" : ""}`}
                      onClick={() => onToggleAlert(h.mint)}
                      aria-pressed={alertMints.has(h.mint)}
                      disabled={!watchedMints.has(h.mint)}
                      title={
                        watchedMints.has(h.mint)
                          ? "Toggle portfolio change alerts"
                          : "Add to watchlist first"
                      }
                    >
                      {alertMints.has(h.mint) ? "On" : "Off"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
