'use client'

import type { WeightedSecurityScore } from '@/lib/services/scanner/types'
import { useInstitutionalTranslation } from '@/lib/i18n/institutional-context'

type Props = {
  breakdown: WeightedSecurityScore['risk_breakdown']
  locked?: boolean
}

function Bar({ label, value, accent }: { label: string; value: number; accent: string }) {
  const w = Math.min(100, Math.max(0, value))
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: '#94a3b8' }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: '#e2e8f0' }} dir="ltr">
          {w}
        </span>
      </div>
      <div dir="ltr" style={{ unicodeBidi: 'isolate' }}>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${w}%`,
              height: '100%',
              borderRadius: 999,
              background: accent,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function RiskBreakdownPanel({ breakdown, locked }: Props) {
  const { t } = useInstitutionalTranslation()

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: '20px 22px',
        border: '0.5px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {locked ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            background: 'rgba(2,6,23,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: 22 }} aria-hidden>
            🔒
          </span>
          <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>{t('institutional.risk_panel.upgrade_title')}</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{t('institutional.risk_panel.upgrade_sub')}</span>
        </div>
      ) : null}
      <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#64748b', marginBottom: 12 }}>{t('institutional.risk_panel.title')}</div>
      <Bar label={t('institutional.risk_panel.liquidity')} value={breakdown.liquidity_risk} accent="linear-gradient(90deg,#06b6d4,#10b981)" />
      <Bar label={t('institutional.risk_panel.wallet')} value={breakdown.wallet_risk} accent="linear-gradient(90deg,#8b5cf6,#10b981)" />
      <Bar label={t('institutional.risk_panel.contract')} value={breakdown.contract_risk} accent="linear-gradient(90deg,#f59e0b,#ef4444)" />
      <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: '#64748b' }}>{t('institutional.risk_panel.footnote')}</p>
    </div>
  )
}
