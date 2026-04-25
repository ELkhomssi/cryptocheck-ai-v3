'use client'

import type { ReasoningObject, Verdict } from '@/lib/services/scanner-engine'
import type { WeightedSecurityScore } from '@/lib/services/scanner/types'
import { useInstitutionalTranslation } from '@/lib/i18n/institutional-context'
import { generateWhyBulletRefs, whyBlockTitleKey } from '@/components/pro/institutional/why-insights'
import type { CanonicalScanResult } from '@/lib/types/canonical-scan'

type Props = {
  verdict: Verdict
  reasoning: ReasoningObject
  weighted: WeightedSecurityScore
  canonical?: CanonicalScanResult | null
}

export function WhyItMattersBlock({ verdict, reasoning, weighted, canonical }: Props) {
  const { t } = useInstitutionalTranslation()
  const bullets = generateWhyBulletRefs(reasoning, weighted, canonical)
  const title = t(whyBlockTitleKey(verdict))

  return (
    <section
      style={{
        borderRadius: 16,
        padding: '20px 22px',
        marginBottom: 'clamp(16px,3vw,22px)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.035)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6ee7b7', fontWeight: 700, marginBottom: 12 }}>{title}</div>
      <ul style={{ margin: 0, paddingInlineStart: 18, color: '#e2e8f0', fontSize: 14, lineHeight: 1.65 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            {t(b.key, b.vars)}
          </li>
        ))}
      </ul>
    </section>
  )
}
