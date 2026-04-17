'use client'

/**
 * SignalRow — one line in the SentinelRiskCard "Top signals" list.
 * Icon + severity color + code + human message + numeric impact.
 */

import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'
import type { RiskSignal } from '@/lib/types/intelligence'

const TONE = {
  info: {
    icon: Info,
    ring: 'ring-sky-400/20 bg-sky-500/10 text-sky-300',
    impact: 'text-sky-300',
  },
  warn: {
    icon: AlertTriangle,
    ring: 'ring-amber-400/20 bg-amber-500/10 text-amber-300',
    impact: 'text-amber-300',
  },
  danger: {
    icon: AlertOctagon,
    ring: 'ring-rose-400/20 bg-rose-500/10 text-rose-300',
    impact: 'text-rose-300',
  },
} as const

export function SignalRow({ signal }: { signal: RiskSignal }) {
  const tone = TONE[signal.severity] ?? TONE.info
  const Icon = tone.icon
  const sign = signal.impact > 0 ? '+' : ''

  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${tone.ring}`}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <code className="font-mono-terminal text-[10px] uppercase tracking-[0.15em] text-slate-500">
            {signal.code}
          </code>
          <span
            className={`font-mono-terminal text-[11px] font-semibold tabular-nums ${tone.impact}`}
          >
            {sign}
            {signal.impact}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
          {signal.message}
        </p>
      </div>
    </li>
  )
}
