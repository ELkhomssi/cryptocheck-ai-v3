'use client'

import type { ReasoningObject } from '@/lib/services/scanner-engine'
import { extractTopHolderPct } from '@/components/pro/institutional/model-helpers'

type Props = {
  reasoning: ReasoningObject
}

/**
 * Wallet intelligence: SVG graph + distribution + mandatory insight panel (no heavy libs).
 */
export function WalletIntelGraph({ reasoning }: Props) {
  const top = extractTopHolderPct(reasoning)
  const mid = Math.min(48, Math.max(18, Math.round((100 - top) * 0.35)))
  const rest = Math.max(0, 100 - top - mid)

  const risk = reasoning.clusterAnalysis.linkedCreatorRisk
  const hits = reasoning.clusterAnalysis.scamLinkedFundingHits
  const suspicious = risk === 'high' || hits >= 2

  const edgeDefault = 'rgba(16,185,129,0.35)'
  const edgeAlert = 'rgba(248,113,113,0.75)'
  const nodeAlert = 'rgba(248,113,113,0.35)'
  const strokeAlert = '#f87171'

  const clusterRiskLabel = risk === 'high' ? 'High' : risk === 'medium' ? 'Medium' : 'Low'
  const scamLabel = hits === 0 ? 'None detected' : `${hits} flagged in model`

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
        WALLET INTELLIGENCE
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>On-chain relationships & supply shape (model view)</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 18, alignItems: 'start' }} className="wi-grid">
        <style>{`
          @media (max-width: 720px) { .wi-grid { grid-template-columns: 1fr !important; } }
        `}</style>

        <div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>GRAPH</div>
          <svg width="100%" height="140" viewBox="0 0 200 140" aria-hidden style={{ display: 'block' }}>
            {/* Center — creator / deployer hub */}
            <circle cx="100" cy="72" r="14" fill="rgba(16,185,129,0.25)" stroke="#10b981" strokeWidth="1.8" />
            <text x="100" y="76" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="system-ui,sans-serif">
              Hub
            </text>

            {/* Edges */}
            <line x1="100" y1="72" x2="40" y2="28" stroke={suspicious ? edgeAlert : edgeDefault} strokeWidth="1.3" />
            <line x1="100" y1="72" x2="160" y2="28" stroke={suspicious ? edgeAlert : edgeDefault} strokeWidth="1.3" />
            <line x1="100" y1="72" x2="32" y2="100" stroke={suspicious ? edgeAlert : edgeDefault} strokeWidth="1.3" />
            <line x1="100" y1="72" x2="168" y2="100" stroke={edgeDefault} strokeWidth="1.2" />
            <line x1="100" y1="72" x2="100" y2="124" stroke="rgba(148,163,184,0.35)" strokeWidth="1.2" />

            {/* Satellite wallets — top pair suspicious when cluster elevated */}
            <circle
              cx="40"
              cy="28"
              r="8"
              fill={suspicious ? nodeAlert : 'rgba(56,189,248,0.2)'}
              stroke={suspicious ? strokeAlert : '#22d3ee'}
              strokeWidth="1.4"
            />
            <circle
              cx="160"
              cy="28"
              r="8"
              fill={suspicious ? nodeAlert : 'rgba(167,139,250,0.2)'}
              stroke={suspicious ? strokeAlert : '#a78bfa'}
              strokeWidth="1.4"
            />
            <circle cx="32" cy="100" r="7" fill="rgba(16,185,129,0.15)" stroke="#34d399" strokeWidth="1.2" />
            <circle cx="168" cy="100" r="7" fill="rgba(148,163,184,0.15)" stroke="#94a3b8" strokeWidth="1.2" />
            <circle cx="100" cy="124" r="7" fill="rgba(16,185,129,0.12)" stroke="#64748b" strokeWidth="1.2" />

            {suspicious ? (
              <text x="100" y="16" textAnchor="middle" fill="#f87171" fontSize="9" fontWeight="700" fontFamily="system-ui,sans-serif">
                Elevated ties
              </text>
            ) : null}
          </svg>
          <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
            {suspicious
              ? 'Red-highlighted nodes indicate counterparties or paths that cluster with elevated behavioral risk.'
              : 'Green paths show clean relationships versus known scam-linked funding in this model pass.'}
          </p>
        </div>

        <div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>DISTRIBUTION</div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 8 }}>
            <strong style={{ color: '#e2e8f0' }}>Top holders</strong> ~{top}% · Mid-tier{' '}
            <strong style={{ color: '#e2e8f0' }}>wallets</strong> ~{mid}% · Long tail ~{rest}%
          </div>
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 5,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)',
              marginBottom: 4,
            }}
          >
            <div style={{ width: `${top}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
            <div style={{ width: `${mid}%`, background: 'linear-gradient(90deg,#22d3ee,#06b6d4)' }} />
            <div style={{ width: `${rest}%`, background: 'rgba(148,163,184,0.35)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b' }}>
            <span>Top</span>
            <span>Mid</span>
            <span>Tail</span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#64748b', marginBottom: 10 }}>INSIGHT PANEL</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            fontSize: 12,
          }}
        >
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.35)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>Cluster risk</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{clusterRiskLabel}</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.35)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>Top holder concentration</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{top.toFixed(1)}%</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.35)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>Linked scam wallets</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{scamLabel}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
