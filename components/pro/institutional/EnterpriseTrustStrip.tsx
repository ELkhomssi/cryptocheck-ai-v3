'use client'

import { useInstitutionalTranslation } from '@/lib/i18n/institutional-context'
import type { InstitutionalLocale } from '@/lib/i18n/institutional-catalog'

function formatRelativeTime(iso: string, locale: InstitutionalLocale, justNowLabel: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diffSec = Math.floor(Math.max(0, Date.now() - t) / 1000)
  if (diffSec < 45) return justNowLabel
  const loc = locale === 'ar' ? 'ar' : locale === 'fr' ? 'fr' : 'en'
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' })
  const min = Math.floor(diffSec / 60)
  if (min < 60) return rtf.format(-min, 'minute')
  const h = Math.floor(min / 60)
  if (h < 24) return rtf.format(-h, 'hour')
  const d = Math.floor(h / 24)
  return rtf.format(-d, 'day')
}

function confidenceWord(c01: number, t: (k: string) => string): string {
  const p = Math.round(c01 * 100)
  if (p >= 80) return t('institutional.trust_strip.confidence_high')
  if (p >= 50) return t('institutional.trust_strip.confidence_medium')
  return t('institutional.trust_strip.confidence_low')
}

type Props = {
  rpcProvider: string
  lastUpdatedIso: string
  confidence01: number
  cache?: 'hit' | 'miss'
}

/**
 * Thin institutional trust row — complements technical RPC telemetry elsewhere.
 */
export function EnterpriseTrustStrip({ rpcProvider, lastUpdatedIso, confidence01, cache }: Props) {
  const { locale, t } = useInstitutionalTranslation()
  const rel = formatRelativeTime(lastUpdatedIso, locale, t('institutional.trust_strip.time_just_now'))
  const conf = confidenceWord(confidence01, t)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px 20px',
        padding: '10px 16px',
        marginBottom: 20,
        borderRadius: 12,
        border: '0.5px solid rgba(16,185,129,0.12)',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: '#94a3b8',
      }}
    >
      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{t('institutional.trust_strip.audit_ready')}</span>
      <span style={{ opacity: 0.35 }}>·</span>
      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{t('institutional.trust_strip.api_verified')}</span>
      <span style={{ opacity: 0.35 }}>·</span>
      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{t('institutional.trust_strip.realtime_scan')}</span>
      <span style={{ opacity: 0.35 }}>|</span>
      <span>
        {t('institutional.trust_strip.source')}{' '}
        <span style={{ color: '#6ee7b7', fontFamily: 'ui-monospace, monospace' }} dir="ltr">
          {rpcProvider}
        </span>
      </span>
      <span style={{ opacity: 0.35 }}>|</span>
      <span>
        {t('institutional.trust_strip.updated')} <span style={{ color: '#e2e8f0' }}>{rel}</span>
      </span>
      <span style={{ opacity: 0.35 }}>|</span>
      <span>
        {t('institutional.trust_strip.confidence_label')} <span style={{ color: '#6ee7b7' }}>{conf}</span>
      </span>
      {cache ? (
        <>
          <span style={{ opacity: 0.35 }}>|</span>
          <span>
            {t('institutional.trust_strip.cache_prefix')}{' '}
            <span style={{ color: cache === 'hit' ? '#34d399' : '#fbbf24' }}>
              {cache === 'hit' ? t('institutional.trust_strip.cache_warm') : t('institutional.trust_strip.cache_fresh')}
            </span>
          </span>
        </>
      ) : null}
    </div>
  )
}
