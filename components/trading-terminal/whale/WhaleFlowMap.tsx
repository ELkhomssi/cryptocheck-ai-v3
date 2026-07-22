"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { WhaleFlowEdge, WhaleFlowNode } from "@/lib/trading-terminal/whale-intelligence";

const NODE_W = 108;
const NODE_H = 44;

function nodeFill(kind: WhaleFlowNode["kind"]): string {
  switch (kind) {
    case "wallet":
      return "rgba(56, 189, 248, 0.14)";
    case "token":
      return "rgba(52, 211, 153, 0.14)";
    case "dex":
      return "rgba(251, 191, 36, 0.14)";
    case "pool":
      return "rgba(167, 139, 250, 0.14)";
  }
}

function nodeStroke(kind: WhaleFlowNode["kind"]): string {
  switch (kind) {
    case "wallet":
      return "rgba(56, 189, 248, 0.55)";
    case "token":
      return "rgba(52, 211, 153, 0.55)";
    case "dex":
      return "rgba(251, 191, 36, 0.55)";
    case "pool":
      return "rgba(167, 139, 250, 0.55)";
  }
}

function edgeStroke(tone: WhaleFlowEdge["tone"]): string {
  switch (tone) {
    case "accum":
      return "rgba(52, 211, 153, 0.65)";
    case "dist":
      return "rgba(248, 113, 113, 0.65)";
    case "watch":
      return "rgba(251, 191, 36, 0.6)";
    case "neutral":
      return "rgba(148, 163, 184, 0.45)";
  }
}

export function WhaleFlowMap({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: WhaleFlowNode[];
  edges: WhaleFlowEdge[];
  selectedId: string | null;
  onSelect: (id: string, kind: WhaleFlowNode["kind"]) => void;
}) {
  const [view, setView] = useState({ x: 0, y: 0, k: 0.85 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [hover, setHover] = useState<WhaleFlowNode | null>(null);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setView((v) => ({ ...v, k: Math.min(2.4, Math.max(0.4, v.k * delta)) }));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as Element).closest("[data-node]")) return;
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [view.x, view.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({
      ...v,
      x: drag.current!.vx + (e.clientX - drag.current!.x),
      y: drag.current!.vy + (e.clientY - drag.current!.y),
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <section className="tit-whale-flow" aria-label="Whale flow map">
      <header className="tit-whale-flow-head">
        <div>
          <p className="tit-eyebrow">Flow graph</p>
          <h2 className="tit-whale-flow-title">Whale Flow Map</h2>
        </div>
        <div className="tit-whale-flow-legend">
          <span data-k="wallet">Wallet</span>
          <span data-k="token">Token</span>
          <span data-k="dex">DEX</span>
          <span data-k="pool">LP</span>
        </div>
        <div className="tit-whale-flow-zoom">
          <button type="button" onClick={() => setView((v) => ({ ...v, k: Math.min(2.4, v.k * 1.15) })}>
            +
          </button>
          <button type="button" onClick={() => setView((v) => ({ ...v, k: Math.max(0.4, v.k * 0.87) }))}>
            −
          </button>
          <button type="button" onClick={() => setView({ x: 0, y: 0, k: 0.85 })}>
            Reset
          </button>
        </div>
      </header>

      <div className="tit-whale-flow-stage">
        {nodes.length === 0 ? (
          <div className="tit-whale-empty tit-whale-flow-empty">Awaiting flow graph feeds</div>
        ) : (
          <svg
            className="tit-whale-flow-svg"
            viewBox="0 0 900 460"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <defs>
              <marker id="tit-whale-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(148,163,184,0.7)" />
              </marker>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {edges.map((e) => {
                const a = nodeMap.get(e.from);
                const b = nodeMap.get(e.to);
                if (!a || !b) return null;
                const x1 = a.x + NODE_W / 2;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x + NODE_W / 2;
                const y2 = b.y + NODE_H / 2;
                return (
                  <g key={e.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={edgeStroke(e.tone)}
                      strokeWidth={1.2 + e.weight * 1.4}
                      strokeOpacity={0.85}
                      markerEnd="url(#tit-whale-arrow)"
                    />
                    {e.label ? (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 6}
                        className="tit-whale-edge-label"
                        textAnchor="middle"
                      >
                        {e.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {nodes.map((n) => {
                const selected = selectedId === n.id || selectedId === n.id.replace(/^(wal|tok):/, "");
                return (
                  <g
                    key={n.id}
                    data-node
                    transform={`translate(${n.x} ${n.y})`}
                    className={`tit-whale-node tone-${n.tone}${selected ? " is-selected" : ""}`}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelect(n.id, n.kind)}
                    style={{ cursor: n.kind === "wallet" || n.kind === "token" ? "pointer" : "default" }}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={4}
                      fill={nodeFill(n.kind)}
                      stroke={selected ? "rgba(255,255,255,0.75)" : nodeStroke(n.kind)}
                      strokeWidth={selected ? 1.6 : 1}
                    />
                    <text x={8} y={18} className="tit-whale-node-kind">
                      {(n.sublabel ?? n.kind).toUpperCase()}
                    </text>
                    <text x={8} y={34} className="tit-whale-node-label">
                      {n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {hover ? (
          <div className="tit-whale-hover-card" role="tooltip">
            <p className="tit-whale-hover-kind">{hover.kind}</p>
            <p className="tit-whale-hover-label">{hover.label}</p>
            {hover.sublabel ? (
              <p className="tit-mono tit-whale-hover-meta">{hover.sublabel}</p>
            ) : null}
            {hover.meta ? (
              <p className="tit-mono tit-whale-hover-meta">
                {Object.entries(hover.meta)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            ) : null}
            <p className="tit-whale-hover-hint">
              {hover.kind === "wallet" || hover.kind === "token" ? "Click to focus" : "Structural node"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
