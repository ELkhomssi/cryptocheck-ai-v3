"use client";

import { useState } from "react";
import {
  type WhaleCohortId,
  type WhaleWalletRow,
  cohortLabel,
  formatUsdSigned,
} from "@/lib/trading-terminal/whale-intelligence";

const COHORTS: WhaleCohortId[] = [
  "top_buyers",
  "smart_money",
  "early_entry",
  "insider_pattern",
  "fresh_accumulation",
];

function truncAddr(a: string): string {
  return a.length < 10 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function WhaleWalletPanel({
  wallets,
  selectedWalletId,
  onSelectWallet,
}: {
  wallets: WhaleWalletRow[];
  selectedWalletId: string | null;
  onSelectWallet: (id: string) => void;
}) {
  const [cohort, setCohort] = useState<WhaleCohortId>("smart_money");
  const rows = wallets.filter((w) => w.cohort === cohort);

  return (
    <aside className="tit-whale-wallets" aria-label="Whale wallet cohorts">
      <header className="tit-whale-wallets-head">
        <div>
          <p className="tit-eyebrow">Smart money</p>
          <h2 className="tit-whale-wallets-title">Wallet Intelligence</h2>
        </div>
        {wallets.some((w) => w.sample) ? (
          <span className="tit-sample-tag" title="Demo cohort metrics">
            sample
          </span>
        ) : null}
      </header>

      <div className="tit-whale-cohort-tabs" role="tablist" aria-label="Wallet cohorts">
        {COHORTS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cohort === c}
            className={`tit-whale-cohort-tab${cohort === c ? " is-active" : ""}`}
            onClick={() => setCohort(c)}
          >
            {cohortLabel(c)}
          </button>
        ))}
      </div>

      <div className="tit-whale-wallet-table-wrap">
        <table className="tit-whale-wallet-table">
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Win%</th>
              <th>Realized</th>
              <th>Unreal.</th>
              <th>Hold</th>
              <th>Last</th>
              <th>Conf</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="tit-whale-empty">
                  No wallets in cohort
                </td>
              </tr>
            ) : (
              rows.map((w) => (
                <tr
                  key={w.id}
                  className={`tit-whale-wallet-row${selectedWalletId === w.id ? " is-selected" : ""}`}
                  onClick={() => onSelectWallet(w.id)}
                >
                  <td>
                    <div className="tit-whale-wallet-cell">
                      <span className="tit-whale-wallet-label">{w.label}</span>
                      <span className="tit-mono tit-whale-wallet-addr">{truncAddr(w.address)}</span>
                    </div>
                  </td>
                  <td className="tit-mono">{w.winRatePct.toFixed(0)}%</td>
                  <td className={`tit-mono ${w.realizedPnlUsd >= 0 ? "tit-whale-pos" : "tit-whale-neg"}`}>
                    {formatUsdSigned(w.realizedPnlUsd)}
                  </td>
                  <td className={`tit-mono ${w.unrealizedPnlUsd >= 0 ? "tit-whale-pos" : "tit-whale-neg"}`}>
                    {formatUsdSigned(w.unrealizedPnlUsd)}
                  </td>
                  <td className="tit-mono">{w.avgHoldHours.toFixed(0)}h</td>
                  <td>
                    <span className={`tit-whale-action tit-whale-action-${w.lastAction}`}>
                      {w.lastAction}
                    </span>
                  </td>
                  <td>
                    <div className="tit-whale-conf">
                      <span className="tit-mono">{w.confidenceScore.toFixed(0)}</span>
                      <span
                        className="tit-whale-conf-bar"
                        style={{ width: `${w.confidenceScore}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
