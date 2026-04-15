'use client'

import type { ReasoningObject } from '@/lib/services/scanner-engine'
import { extractTopHolderPct } from '@/components/pro/institutional/model-helpers'

type Props = {
  reasoning: ReasoningObject
}

const EM = {
  fill: 'rgba(16,185,129,0.22)',
  stroke: '#10b981',
  edge: 'rgba(16,185,129,0.55)',
}
const RD = {
  fill: 'rgba(248,113,113,0.22)',
  stroke: '#ef4444',
  edge: 'rgba(248,113,113,0.65)',
}

/** Hardcoded node layout (hub + 5 satellites). Order: first N marked suspicious from evidence. */
const NODES = [
  { key: 'nw', cx: 42, cy: 34, r: 9 },
  { key: 'ne', cx: 198, cy: 34, r: 9 },
  { key: 'sw', cx: 34, cy: 118, r: 8 },
  { key: 'se', cx: 206, cy: 118, r: 8 },
  { key: 's', cx: 120, cy: 138, r: 7 },
] as const

const HUB = { cx: 120, cy: 82, r: 15 }

/**
 * Maps evidence → how many satellite nodes render as suspicious (red) vs healthy (emerald).
 */
function suspiciousSatelliteCount(reasoning: ReasoningObject): number {
  const risk = reasoning.clusterAnalysis.linkedCreatorRisk
  const hits = reasoning.clusterAnalysis.scamLinkedFundingHits
  if (risk === 'high' || hits >= 2) return 3
  if (risk === 'medium' || hits === 1) return 2
  return 0
}

function hubStrokeFromEvidence(topPct: number, suspiciousCount: number): string {
  if (suspiciousCount >= 2) return '#34d399'
  if (topPct > 40) return '#6ee7b7'
  return '#10b981'
}

/**
 * Wallet intelligence: hardcoded SVG graph (emerald = healthy, red = suspicious cluster) + 3-metric insight panel.
 */
export function WalletIntelGraph({ reasoning }: Props) {
  const top = extractTopHolderPct(reasoning)
  const mid = Math.min(48, Math.max(18, Math.round((100 - top) * 0.35)))
  const rest = Math.max(0, 100 - top - mid)

  const risk = reasoning.clusterAnalysis.linkedCreatorRisk
  const hits = reasoning.clusterAnalysis.scamLinkedFundingHits

  const susN = suspiciousSatelliteCount(reasoning)
  const hubStroke = hubStrokeFromEvidence(top, susN)

  const clusterRiskLabel = risk === 'high' ? 'High' : risk === 'medium' ? 'Medium' : 'Low'
  const metricScam = hits === 0 ? 'None' : `${hits} flagged`

  return (
    <div
      style={{
        borderRadius: 16,
        padding: '18px 20px',
        border: '0.5px solid rgba(16,185,129,0.12)',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.16em', color: '#6ee7b7', fontWeight: 700, marginBottom: 4 }}>
        WALLET INTELLIGENCE 2.0
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Graph state is driven by cluster risk, scam-link hits, and holder concentration from the active scan.</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }} className="wi-grid">
        <style>{`
          @media (max-width: 720px) { .wi-grid { grid-template-columns: 1fr !important; } }
        `}</style>

        <div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>RELATIONSHIP GRAPH</div>
          <svg width="100%" height="168" viewBox="0 0 240 168" aria-label="Wallet cluster graph" style={{ display: 'block' }}>
            <defs>
              <filter id="wi-glow-em" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Edges: hub → each satellite — color matches destination node */}
            {NODES.map((n, i) => {
              const suspicious = i < susN
              const pal = suspicious ? RD : EM
              return (
                <line
                  key={`e-${n.key}`}
                  x1={HUB.cx}
                  y1={HUB.cy}
                  x2={n.cx}
                  y2={n.cy}
                  stroke={pal.edge}
                  strokeWidth={suspicious ? 1.6 : 1.25}
                  strokeLinecap="round"
                />
              )
            })}

            {/* Hub */}
            <circle
              cx={HUB.cx}
              cy={HUB.cy}
              r={HUB.r}
              fill="rgba(16,185,129,0.18)"
              stroke={hubStroke}
              strokeWidth="2"
              filter="url(#wi-glow-em)"
            />
            <text x={HUB.cx} y={HUB.cy + 4} textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight={600} fontFamily="ui-sans-serif,system-ui,sans-serif">
              Core
            </text>

            {/* Satellites */}
            {NODES.map((n, i) => {
              const suspicious = i < susN
              const pal = suspicious ? RD : EM
              return (
                <g key={n.key}>
                  <circle cx={n.cx} cy={n.cy} r={n.r} fill={pal.fill} stroke={pal.stroke} strokeWidth="1.6" />
                  <text
                    x={n.cx}
                    y={n.cy + 3}
                    textAnchor="middle"
                    fill={suspicious ? '#fecaca' : '#a7f3d0'}
                    fontSize="7"
                    fontWeight={600}
                    fontFamily="ui-sans-serif,system-ui,sans-serif"
                  >
                    {suspicious ? '!' : '·'}
                  </text>
                </g>
              )
            })}

            <text x={120} y={14} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="ui-sans-serif,system-ui,sans-serif" letterSpacing="0.12em">
              {susN > 0 ? `${susN} cluster${susN > 1 ? 's' : ''} flagged` : 'All links clear vs model'}
            </text>
          </svg>
          <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
            <span style={{ color: '#6ee7b7' }}>Emerald</span> nodes and edges are healthy paths;{' '}
            <span style={{ color: '#f87171' }}>red</span> marks satellites that align with suspicious cluster or scam-link evidence.
          </p>
        </div>

        <div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>SUPPLY DISTRIBUTION</div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 8 }}>
            Top <strong style={{ color: '#e2e8f0' }}>{top.toFixed(1)}%</strong> · Mid{' '}
            <strong style={{ color: '#e2e8f0' }}>{mid}%</strong> · Tail <strong style={{ color: '#e2e8f0' }}>{rest}%</strong>
          </div>
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 5,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ width: `${top}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
            <div style={{ width: `${mid}%`, background: 'linear-gradient(90deg,#22d3ee,#06b6d4)' }} />
            <div style={{ width: `${rest}%`, background: 'rgba(148,163,184,0.35)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', marginTop: 4 }}>
            <span>Top</span>
            <span>Mid</span>
            <span>Tail</span>
          </div>
        </div>
      </div>

      {/* Exactly 3 metrics — aligned to graph + distribution */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#64748b', marginBottom: 12 }}>INSIGHT PANEL</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            fontSize: 12,
          }}
          className="wi-insight-3"
        >
          <style>{`
            @media (max-width: 520px) {
              .wi-insight-3 { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.38)',
              border: `0.5px solid ${risk === 'high' ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, letterSpacing: '0.06em' }}>1 · Cluster risk</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18 }}>{clusterRiskLabel}</div>
            <div style={{ color: '#64748b', fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
              Matches red nodes in the graph ({susN} elevated).
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.38)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, letterSpacing: '0.06em' }}>2 · Top holder concentration</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18 }}>{top.toFixed(1)}%</div>
            <div style={{ color: '#64748b', fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
              Same figure as the distribution bar above.
            </div>
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.38)',
              border: `0.5px solid ${hits > 0 ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, letterSpacing: '0.06em' }}>3 · Linked scam signals</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18 }}>{metricScam}</div>
            <div style={{ color: '#64748b', fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
              Drives additional red nodes when hits ≥ 1.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
