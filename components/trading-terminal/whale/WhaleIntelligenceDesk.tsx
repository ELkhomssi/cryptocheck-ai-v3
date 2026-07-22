"use client";

import { useMemo, useState } from "react";
import { buildWhaleIntelligence } from "@/lib/trading-terminal/whale-intelligence";
import type { TerminalDataMode } from "@/lib/trading-terminal/data/types";
import { WhaleWalletPanel } from "./WhaleWalletPanel";
import { WhaleFlowMap } from "./WhaleFlowMap";
import { WhaleLiveFeed } from "./WhaleLiveFeed";
import { WhaleConsensusEngine } from "./WhaleConsensusEngine";

export function WhaleIntelligenceDesk({ mode }: { mode: TerminalDataMode }) {
  const bundle = useMemo(() => buildWhaleIntelligence(mode), [mode]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(
    bundle.wallets[0]?.id ?? null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedWallet = bundle.wallets.find((w) => w.id === selectedWalletId) ?? null;

  const onSelectWallet = (id: string) => {
    setSelectedWalletId(id);
    setSelectedNodeId(`wal:${id}`);
  };

  const onSelectWalletAddress = (address: string) => {
    const w = bundle.wallets.find((row) => row.address === address);
    if (w) onSelectWallet(w.id);
  };

  const onSelectNode = (id: string, kind: "wallet" | "token" | "dex" | "pool") => {
    setSelectedNodeId(id);
    if (kind === "wallet" && id.startsWith("wal:")) {
      setSelectedWalletId(id.slice(4));
    }
  };

  return (
    <div className="tit-whale-desk" data-mode={mode}>
      <header className="tit-whale-desk-banner">
        <div>
          <p className="tit-eyebrow">Institutional module</p>
          <h1 className="tit-whale-desk-title">Whale Intelligence</h1>
        </div>
        <p className="tit-whale-desk-sub">
          Smart money cohorts · flow graph · live tape · consensus engine
        </p>
        {bundle.sample ? (
          <span className="tit-sample-tag" title="Demo whale intelligence desk">
            sample
          </span>
        ) : (
          <span className="tit-whale-live-badge">live · awaiting feeds</span>
        )}
        <span className="tit-mono tit-whale-method">{bundle.methodNote}</span>
      </header>

      <div className="tit-whale-desk-grid">
        <WhaleWalletPanel
          wallets={bundle.wallets}
          selectedWalletId={selectedWalletId}
          onSelectWallet={onSelectWallet}
        />
        <WhaleFlowMap
          nodes={bundle.nodes}
          edges={bundle.edges}
          selectedId={selectedNodeId ?? (selectedWalletId ? `wal:${selectedWalletId}` : null)}
          onSelect={onSelectNode}
        />
        <WhaleLiveFeed
          events={bundle.feed}
          selectedWalletAddress={selectedWallet?.address ?? null}
          onSelectWalletAddress={onSelectWalletAddress}
        />
        <WhaleConsensusEngine consensus={bundle.consensus} />
      </div>
    </div>
  );
}
