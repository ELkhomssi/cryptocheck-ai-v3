import type { Verdict } from '@/lib/services/scanner-engine'

type Props = {
  score: number
  verdict: Verdict
  confidence: number
  subtitle?: string
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

export function InstitutionalHero({ score, verdict, confidence, subtitle }: Props) {
  const badge = badgeColors(verdict)
  const pct = Math.round(confidence * 100)
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
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              color: '#94a3b8',
              border: '0.5px solid rgba(148,163,184,0.25)',
              background: 'rgba(15,23,42,0.5)',
            }}
          >
            Confidence {pct}%
          </span>
        </div>
        {subtitle ? (
          <p style={{ marginTop: 18, fontSize: 13, color: '#94a3b8', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </section>
  )
}
