'use client'

/**
 * ScanResultSurface — Phase 4D
 *
 * Rendering branches:
 *   - No scan yet           → `EmptyState`
 *   - Loading (scan active) → `ReportSkeleton` (mirrors real layout)
 *   - Error                 → handled inline by CommandLineInput
 *   - Populated             → `ReportGrid`
 *
 * `aria-live="polite"` sits on the skeleton container so screen
 * readers announce "Loading report" without interrupting the user.
 */

import { Radar } from 'lucide-react'
import { ReportGrid } from '../report/ReportGrid'
import { ReportSkeleton } from '../report/ReportSkeleton'
import { useTerminal } from '../TerminalProvider'

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center gap-6 text-center">
      <div
        className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]"
        aria-hidden
      >
        <Radar className="h-10 w-10 text-slate-700 motion-safe:animate-pulse" />
      </div>
      <div>
        <h2 className="font-mono text-base tracking-wide text-slate-400">
          Awaiting target
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Paste any Solana mint address above to begin intelligence analysis.
        </p>
      </div>
    </div>
  )
}

export function ScanResultSurface() {
  const { state } = useTerminal()
  const scan = state.currentScan

  if (!scan) {
    return <EmptyState />
  }

  if (scan.status === 'loading') {
    return <ReportSkeleton />
  }

  if (scan.status === 'error') {
    // Error text is already surfaced next to the input by CommandLineInput;
    // keep the result surface empty so focus stays on the error.
    return <EmptyState />
  }

  if (scan.report) {
    return <ReportGrid report={scan.report} />
  }

  return <EmptyState />
}
