'use client'

import { useInstitutionalTranslation } from '@/lib/i18n/institutional-context'

/**
 * Visual confidence (0–1) — instant read: green ≥80%, amber 50–79%, red <50%.
 */
export function ConfidenceMeter({ value01 }: { value01: number }) {
  const { t } = useInstitutionalTranslation()
  const pct = Math.round(Math.min(1, Math.max(0, value01)) * 100)
  const tier = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low'
  const barColor =
    tier === 'high'
      ? 'linear-gradient(90deg, #059669, #34d399)'
      : tier === 'mid'
        ? 'linear-gradient(90deg, #ca8a04, #facc15)'
        : 'linear-gradient(90deg, #b91c1c, #f87171)'
  const badgeBg =
    tier === 'high'
      ? 'rgba(16,185,129,0.18)'
      : tier === 'mid'
        ? 'rgba(234,179,8,0.15)'
        : 'rgba(248,113,113,0.15)'
  const badgeFg = tier === 'high' ? '#6ee7b7' : tier === 'mid' ? '#fde047' : '#fca5a5'
  const label =
    tier === 'high'
      ? t('institutional.confidence.strong_signal')
      : tier === 'mid'
        ? t('institutional.confidence.moderate_signal')
        : t('institutional.confidence.limited_signal')

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          fontSize: 11,
          letterSpacing: '0.08em',
          color: '#94a3b8',
        }}
      >
        <span>{t('institutional.confidence.data_confidence')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 6,
              background: badgeBg,
              color: badgeFg,
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </span>
          <span style={{ fontFamily: 'ui-monospace, monospace', color: '#f1f5f9', fontWeight: 700 }} dir="ltr">
            {pct}%
          </span>
        </span>
      </div>
      <div dir="ltr" style={{ unicodeBidi: 'isolate' }}>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 999,
              background: barColor,
              boxShadow: tier === 'high' ? '0 0 20px rgba(16,185,129,0.35)' : undefined,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>
    </div>
  )
}
