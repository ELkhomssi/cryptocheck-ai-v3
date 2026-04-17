'use client'

/**
 * SentinelRiskCard — Phase 4C hero card.
 *
 * What users see first. Dominated by:
 *   • Animated count-up score (0 → N)
 *   • Verdict pill with colored dot
 *   • Radial gauge (RiskGauge)
 *   • Top 3 signals
 *
 * Uses Card `accent` to tint the gradient-top-border to match verdict.
 *
 * When the report is missing risk fields (rare but possible for partial
 * scans), falls back to a neutral "Risk data unavailable" state.
 */

import { Shield } from 'lucide-react'
import type {
  RiskVerdict,
  TokenIntelligenceReport,
} from '@/lib/types/intelligence'
import { AnimatedNumber } from '../primitives/AnimatedNumber'
import { Card } from '../primitives/Card'
import type { Verdict } from '../design/tokens'
import { RiskGauge } from './RiskGauge'
import { SignalRow } from './SignalRow'

type VerdictStyle = {
  pillClass: string
  dotClass: string
  scoreClass: string
  glowClass: string
}

const VERDICT_STYLES: Record<Verdict, VerdictStyle> = {
  SAFE: {
    pillClass: 'border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]',
    dotClass: 'bg-[#00d4aa]',
    scoreClass: 'text-[#00d4aa]',
    glowClass: 'motion-safe:animate-[verdict-glow-safe_1.2s_ease-out_forwards]',
  },
  CAUTION: {
    pillClass: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    dotClass: 'bg-amber-400',
    scoreClass: 'text-[#00d4aa]',
    glowClass: 'motion-safe:animate-[verdict-glow-safe_1.2s_ease-out_forwards]',
  },
  RISKY: {
    pillClass: 'border-orange-400/40 bg-orange-500/10 text-orange-200',
    dotClass: 'bg-orange-400',
    scoreClass: 'text-[#ff4757]',
    glowClass:
      'motion-safe:animate-[verdict-glow-danger_1.2s_ease-out_forwards]',
  },
  DANGER: {
    pillClass: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    dotClass: 'bg-rose-500',
    scoreClass: 'text-[#ff4757]',
    glowClass:
      'motion-safe:animate-[verdict-glow-danger_1.2s_ease-out_forwards]',
  },
}

function verdictToAccent(v: Verdict): 'safe' | 'danger' | 'warning' {
  if (v === 'SAFE') return 'safe'
  if (v === 'CAUTION') return 'warning'
  return 'danger'
}

function Unavailable() {
  return (
    <Card accent="neutral" className="flex min-h-[360px] flex-col p-8 md:p-10">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
        <Shield className="h-3.5 w-3.5" aria-hidden />
        <span>Sentinel Risk Engine</span>
      </div>
      <div className="my-auto text-center">
        <p className="font-mono text-sm text-slate-400">
          Risk data unavailable for this scan.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Try re-running the scan with a fresh request.
        </p>
      </div>
    </Card>
  )
}

export function SentinelRiskCard({
  report,
}: {
  report: TokenIntelligenceReport
}) {
  const verdict = report.riskVerdict as RiskVerdict | null | undefined
  const score = report.riskScore

  if (verdict == null || score == null) {
    return <Unavailable />
  }

  const styles = VERDICT_STYLES[verdict]
  const signals = (report.riskSignals ?? []).slice(0, 3)

  return (
    <Card
      accent={verdictToAccent(verdict)}
      className="flex min-h-[360px] flex-col p-6 md:p-10"
    >
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          <Shield className="h-3.5 w-3.5" aria-hidden />
          <span>Sentinel Risk Engine</span>
        </div>
        <span className="font-mono text-[10px] text-slate-600">v2.0</span>
      </div>

      {/* Score + Gauge */}
      <div className="mt-6 grid flex-1 grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto] md:gap-10">
        <div>
          <div
            aria-live="polite"
            aria-label={`Risk score ${score} of 100, verdict ${verdict}`}
            className={`font-mono text-7xl font-semibold leading-none md:text-8xl ${styles.scoreClass} ${styles.glowClass}`}
          >
            <AnimatedNumber value={score} duration={800} />
          </div>
          <div className="mt-2 font-mono text-[11px] tracking-widest text-slate-500">
            / 100
          </div>

          <div
            className={`mt-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${styles.pillClass}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${styles.dotClass}`}
              aria-hidden
            />
            <span className="font-mono text-xs font-semibold tracking-[0.2em]">
              {verdict}
            </span>
          </div>
        </div>

        <RiskGauge score={score} verdict={verdict} />
      </div>

      {/* Top signals */}
      {signals.length > 0 ? (
        <div className="mt-8 border-t border-white/5 pt-6">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Top signals
          </div>
          <ul className="space-y-3">
            {signals.map((s) => (
              <SignalRow key={s.code} signal={s} />
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}
