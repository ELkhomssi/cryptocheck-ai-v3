'use client'

import type { ReasoningObject } from '@/lib/services/scanner-engine'

function extractTopHolderPct(r: ReasoningObject): number {
  const line = r.evidence.find((e) => e.id === 'ev_concentration')
  const m = line?.detail.match(/(\d+\.?\d*)%/)
  if (m) return Math.min(100, Math.max(0, parseFloat(m[1])))
  return 12
}

type Props = {
  reasoning: ReasoningObject
}

/**
 * Lightweight SVG: indicative supply tranches + minimal cluster motif (no chart libs).
 */
export function WalletIntelGraph({ reasoning }: Props) {
  const top = extractTopHolderPct(reasoning)
  const mid = Math.min(48, Math.max(18, Math.round((100 - top) * 0.35)))
  const rest = Math.max(0, 100 - top - mid)

  const risk = reasoning.clusterAnalysis.linkedCreatorRisk

  return (
    <div
      style={{
        borderRadius: 16,
        padding: '16px 18px',
        border: '0.5px solid rgba(16,185,129,0.12)',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#64748b', marginBottom: 12 }}>WALLET & DISTRIBUTION</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14 }}>
        <svg width="120" height="72" viewBox="0 0 120 72" aria-hidden style={{ flexShrink: 0 }}>
          <line x1="60" y1="36" x2="24" y2="14" stroke="rgba(16,185,129,0.45)" strokeWidth="1.2" />
          <line x1="60" y1="36" x2="96" y2="14" stroke="rgba(16,185,129,0.35)" strokeWidth="1.2" />
          <line x1="60" y1="36" x2="60" y2="62" stroke="rgba(148,163,184,0.35)" strokeWidth="1.2" />
          <circle cx="60" cy="36" r="9" fill="rgba(16,185,129,0.25)" stroke="#10b981" strokeWidth="1.5" />
          <circle cx="24" cy="14" r="6" fill="rgba(56,189,248,0.2)" stroke="#22d3ee" strokeWidth="1.2" />
          <circle cx="96" cy="14" r="6" fill="rgba(167,139,250,0.2)" stroke="#a78bfa" strokeWidth="1.2" />
          <circle cx="60" cy="62" r="6" fill="rgba(148,163,184,0.15)" stroke="#94a3b8" strokeWidth="1.2" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>
            Indicative graph: creator hub, counterparties, and exit route — aligned with cluster risk{' '}
            <span style={{ color: risk === 'high' ? '#f87171' : risk === 'medium' ? '#fbbf24' : '#6ee7b7' }}>({risk})</span>.
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Supply tranches (model-derived)</div>
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ width: `${top}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} title={`Top concentration ~${top}%`} />
        <div style={{ width: `${mid}%`, background: 'linear-gradient(90deg,#22d3ee,#06b6d4)' }} />
        <div style={{ width: `${rest}%`, background: 'rgba(148,163,184,0.35)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: '#64748b' }}>
        <span>Top wallets ~{top}%</span>
        <span>Mid ~{mid}%</span>
        <span>Long tail ~{rest}%</span>
      </div>
    </div>
  )
}
