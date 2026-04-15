'use client'

import type { Verdict } from '@/lib/services/scanner-engine'
import { ConfidenceMeter } from '@/components/pro/institutional/ConfidenceMeter'

type Props = {
  score: number
  verdict: Verdict
  confidence: number
  subtitle?: string
  primaryCta?: {
    label: string
    onClick: () => void
    disabled?: boolean
    loading?: boolean
  }
}

function verdictLabel(v: Verdict): 'SAFE' | 'CAUTION' | 'DANGER' {
  if (v === 'SAFE') return 'SAFE'
  if (v === 'CAUTION') return 'CAUTION'
  return 'DANGER'
}

function badgeColors(verdict: Verdict): { bg: string; border: string; fg: string } {
  if (verdict === 'SAFE') return { bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.45)', fg: '#34d399' }
  if (verdict === 'CAUTION') return { bg: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.45)', fg: '#fbbf24' }
  return { bg: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.45)', fg: '#f87171' }
}

export function InstitutionalHero({ score, verdict, confidence, subtitle, primaryCta }: Props) {
  const badge = badgeColors(verdict)
  const label = verdictLabel(verdict)

  return (
    <section
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: 'clamp(28px,5vw,48px) clamp(20px,4vw,40px)',
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
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'rgba(16,185,129,0.85)',
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          SECURITY SCORE
        </div>
        <div
          style={{
            fontSize: 'clamp(52px,14vw,96px)',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: '#ecfdf5',
            textShadow: '0 0 60px rgba(16,185,129,0.25)',
          }}
        >
          {score}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              ...badge,
            }}
          >
            {label}
          </span>
        </div>

        <ConfidenceMeter value01={confidence} />

        {primaryCta ? (
          <div style={{ marginTop: 24 }}>
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
              {primaryCta.loading ? 'Running scan…' : primaryCta.label}
            </button>
          </div>
        ) : null}

        {subtitle ? (
          <p
            style={{
              marginTop: 20,
              fontSize: 13,
              color: '#94a3b8',
              maxWidth: 520,
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
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
