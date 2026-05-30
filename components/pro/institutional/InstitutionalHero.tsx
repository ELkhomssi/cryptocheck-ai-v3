'use client'

import type { Verdict } from '@cryptocheck/types'
import { useInstitutionalTranslation } from '@/lib/i18n/institutional-context'
import { ConfidenceMeter } from '@/components/pro/institutional/ConfidenceMeter'
import { EnterpriseTrustStrip } from '@/components/pro/institutional/EnterpriseTrustStrip'

type Props = {
  score: number
  verdict: Verdict
  confidence: number
  primaryCta?: {
    label: string
    onClick: () => void
    disabled?: boolean
    loading?: boolean
  }
  /** Enterprise trust + latency context */
  trustContext: {
    rpcProvider: string
    lastUpdatedIso: string
    confidence01: number
    cache?: 'hit' | 'miss'
    pipelineMs?: number
    responseTimeMs?: number
  }
  /** Subtle urgency line under primary CTA */
  urgencyLine?: string
}

function badgeColors(verdict: Verdict): { bg: string; border: string; fg: string } {
  if (verdict === 'SAFE') return { bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.45)', fg: '#34d399' }
  if (verdict === 'CAUTION') return { bg: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.45)', fg: '#fbbf24' }
  return { bg: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.45)', fg: '#f87171' }
}

function verdictStatusKey(verdict: Verdict): string {
  if (verdict === 'SAFE') return 'institutional.status.safe'
  if (verdict === 'CAUTION') return 'institutional.status.caution'
  return 'institutional.status.danger'
}

function verdictRiskTierKey(verdict: Verdict): string {
  if (verdict === 'SAFE') return 'institutional.decision.risk_tier.low'
  if (verdict === 'CAUTION') return 'institutional.decision.risk_tier.moderate'
  return 'institutional.decision.risk_tier.high'
}

function verdictAssetKey(verdict: Verdict): string {
  if (verdict === 'SAFE') return 'institutional.decision.assets.low'
  if (verdict === 'CAUTION') return 'institutional.decision.assets.moderate'
  return 'institutional.decision.assets.high'
}

export function InstitutionalHero({ score, verdict, confidence, primaryCta, trustContext, urgencyLine }: Props) {
  const { t } = useInstitutionalTranslation()
  const badge = badgeColors(verdict)
  const { pipelineMs, responseTimeMs, ...stripProps } = trustContext

  const statusLabel = t(verdictStatusKey(verdict))
  const riskTierLabel = t(verdictRiskTierKey(verdict))
  const decisionLabel = t(verdictAssetKey(verdict))

  return (
    <section
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: 'clamp(22px,4vw,40px) clamp(18px,4vw,36px)',
        marginBottom: 'clamp(20px,4vw,28px)',
        border: '0.5px solid rgba(16,185,129,0.15)',
        background: 'linear-gradient(165deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.03) 48%, rgba(0,0,0,0.2) 100%)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% -20%, rgba(16,185,129,0.15), transparent)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <EnterpriseTrustStrip {...stripProps} />

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: '#94a3b8',
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {t('institutional.hero.security_score')}
          </div>
          <div
            style={{
              fontSize: 'clamp(52px,14vw,96px)',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: '#f8fafc',
              textShadow: '0 0 60px rgba(16,185,129,0.25)',
            }}
          >
            {score}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: 420,
            margin: '0 auto 18px',
            textAlign: 'start',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              border: '0.5px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <span style={{ fontSize: 12, letterSpacing: '0.14em', color: '#64748b', fontWeight: 600 }}>
              {t('institutional.hero.status')}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                padding: '6px 14px',
                borderRadius: 8,
                ...badge,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              border: '0.5px solid rgba(16,185,129,0.2)',
              background: 'rgba(16,185,129,0.06)',
            }}
          >
            <span style={{ fontSize: 12, letterSpacing: '0.14em', color: '#64748b', fontWeight: 600 }}>
              {t('institutional.hero.decision')}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#6ee7b7', textAlign: 'end' }}>{decisionLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', paddingInlineStart: 2 }}>
            {t('institutional.hero.risk_tier_prefix')} {riskTierLabel}
          </div>
        </div>

        {(pipelineMs != null || responseTimeMs != null) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 16,
              marginBottom: 10,
              fontSize: 10,
              letterSpacing: '0.08em',
              color: '#64748b',
            }}
          >
            {pipelineMs != null ? <span dir="ltr">{t('institutional.hero.pipeline_ms', { ms: pipelineMs })}</span> : null}
            {responseTimeMs != null ? <span dir="ltr">{t('institutional.hero.api_ms', { ms: responseTimeMs })}</span> : null}
          </div>
        )}

        <ConfidenceMeter value01={confidence} />

        {primaryCta ? (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              type="button"
              onClick={primaryCta.onClick}
              disabled={primaryCta.disabled || primaryCta.loading}
              className="cc-pro-primary-cta"
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '14px 32px',
                borderRadius: 12,
                border: 'none',
                cursor: primaryCta.disabled || primaryCta.loading ? 'not-allowed' : 'pointer',
                color: '#020617',
                background:
                  primaryCta.disabled || primaryCta.loading
                    ? 'rgba(16,185,129,0.35)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 55%, #047857 100%)',
                boxShadow:
                  primaryCta.disabled || primaryCta.loading
                    ? 'none'
                    : '0 0 0 1px rgba(16,185,129,0.4), 0 12px 40px rgba(16,185,129,0.35)',
                opacity: primaryCta.disabled && !primaryCta.loading ? 0.65 : 1,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {primaryCta.loading ? t('institutional.cta.running') : primaryCta.label}
            </button>
            {urgencyLine ? (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: '#64748b',
                  letterSpacing: '0.04em',
                  maxWidth: 360,
                  marginInline: 'auto',
                  lineHeight: 1.5,
                }}
              >
                {urgencyLine}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .cc-pro-primary-cta:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 0 0 1px rgba(16,185,129,0.55), 0 16px 48px rgba(16,185,129,0.45) !important;
        }
      `,
        }}
      />
    </section>
  )
}
