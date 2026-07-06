'use client'

import { Loader2 } from 'lucide-react'
import type { RevenueVerdict, ScanResult } from '@/lib/revenue-dashboard/types'

const VERDICT_STYLES: Record<RevenueVerdict, string> = {
  SAFE: 'border-rd-safe/40 text-rd-safe',
  CAUTION: 'border-rd-caution/40 text-rd-caution',
  DANGER: 'border-rd-danger/40 text-rd-danger',
}

type Props = {
  scan: ScanResult | null
  loading: boolean
  error: string | null
}

export function VerdictPanel({ scan, loading, error }: Props) {
  return (
    <section className="rd-panel p-4 md:p-5" aria-label="Neural verdict">
      <p className="rd-label mb-3">Neural verdict</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-rd-mid">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
          Scanning via gateway…
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-rd-danger" role="alert">
          {error}
        </p>
      ) : null}

      {scan && !loading ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-rd-sm border px-2.5 py-1 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider ${VERDICT_STYLES[scan.verdict]}`}
            >
              {scan.verdict}
            </span>
            <span className="font-rd-mono text-lg tabular-nums text-rd-hi">{scan.safetyScore}/100</span>
            <span className="text-xs text-rd-lo">confidence: {scan.confidence}</span>
            {scan.sample ? <span className="rd-sample-tag">sample</span> : null}
          </div>

          <p className="text-sm text-rd-mid">{scan.evidenceLine}</p>

          {scan.topSignals.length > 0 ? (
            <ul className="space-y-1.5 border-t border-white/[0.06] pt-3">
              {scan.topSignals.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 text-xs">
                  <span className="text-rd-mid">{s.label}</span>
                  <span className="shrink-0 font-rd-mono tabular-nums text-rd-lo">+{s.weight}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : !loading && !error ? (
        <p className="text-sm text-rd-mid">Enter a token mint to run a neural scan.</p>
      ) : null}
    </section>
  )
}
