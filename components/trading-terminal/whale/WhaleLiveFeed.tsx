"use client";

import {
  type WhaleFeedEvent,
  formatUsdSigned,
  formatWhaleTime,
} from "@/lib/trading-terminal/whale-intelligence";

const TYPE_LABEL: Record<WhaleFeedEvent["type"], string> = {
  BUY: "BUY",
  SELL: "SELL",
  ACCUMULATION: "ACCUM",
  DISTRIBUTION: "DISTRIB",
  INSIDER_SIGNAL: "INSIDER",
  LIQUIDITY_MOVE: "LIQ MOVE",
};

export function WhaleLiveFeed({
  events,
  selectedWalletAddress,
  onSelectWalletAddress,
}: {
  events: WhaleFeedEvent[];
  selectedWalletAddress: string | null;
  onSelectWalletAddress: (address: string) => void;
}) {
  return (
    <aside className="tit-whale-feed" aria-label="Live whale feed">
      <header className="tit-whale-feed-head">
        <div>
          <p className="tit-eyebrow">Tape</p>
          <h2 className="tit-whale-feed-title">Live Whale Feed</h2>
        </div>
        <span className="tit-live-dot" aria-hidden />
      </header>

      <ul className="tit-whale-feed-list">
        {events.length === 0 ? (
          <li className="tit-whale-empty">Awaiting whale events</li>
        ) : (
          events.map((ev) => (
            <li
              key={ev.id}
              className={`tit-whale-feed-item tone-${ev.tone}${
                selectedWalletAddress && ev.walletAddress === selectedWalletAddress ? " is-linked" : ""
              }`}
            >
              <div className="tit-whale-feed-row1">
                <span className={`tit-whale-feed-type type-${ev.type}`}>{TYPE_LABEL[ev.type]}</span>
                <time className="tit-mono" dateTime={ev.at}>
                  {formatWhaleTime(ev.at)}
                </time>
              </div>
              <button
                type="button"
                className="tit-whale-feed-wallet"
                onClick={() => onSelectWalletAddress(ev.walletAddress)}
              >
                {ev.walletLabel}
              </button>
              <div className="tit-whale-feed-row2">
                <span className="tit-whale-feed-token">{ev.tokenSymbol}</span>
                {ev.usdNotional != null ? (
                  <span
                    className={`tit-mono ${
                      ev.tone === "dist" ? "tit-whale-neg" : "tit-whale-pos"
                    }`}
                  >
                    {formatUsdSigned(ev.tone === "dist" ? -ev.usdNotional : ev.usdNotional)}
                  </span>
                ) : null}
                {ev.sample ? <span className="tit-sample-tag">sample</span> : null}
              </div>
              <p className="tit-whale-feed-summary">{ev.description}</p>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
