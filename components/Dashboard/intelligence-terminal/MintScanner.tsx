'use client'

import { Loader2, Search } from 'lucide-react'
import { useCallback, useId, useState, type FormEvent } from 'react'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { IntelReportCards } from './IntelReportCards'
import { useTerminal } from './TerminalProvider'

function shortMint(mint: string): string {
  if (mint.length <= 12) return mint
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`
}

function formatRelativeTime(at: number): string {
  const sec = Math.floor((Date.now() - at) / 1000)
  if (sec < 10) return 'Just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function verdictTone(v: string | null): string {
  if (!v) return 'text-slate-500'
  switch (v) {
    case 'SAFE':
      return 'text-emerald-300/95'
    case 'CAUTION':
      return 'text-amber-300/95'
    case 'RISKY':
      return 'text-orange-300/95'
    case 'DANGER':
      return 'text-rose-300/95'
    default:
      return 'text-slate-400'
  }
}

export function MintScanner() {
  const { state, actions } = useTerminal()
  const [mint, setMint] = useState('')
  const scanErrorId = useId()
  const validationErrorId = useId()

  const trimmed = mint.trim()
  const valid = trimmed === '' || isValidSolanaMint(trimmed)
  const scanning = state.currentScan?.status === 'loading'
  const scanError = state.currentScan?.status === 'error' ? state.currentScan.error : null
  const showValidation = trimmed.length > 0 && !valid

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const m = mint.trim()
      if (!m || !isValidSolanaMint(m) || scanning) return
      await actions.scan(m)
    },
    [mint, scanning, actions]
  )

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md md:p-8">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#00d4aa]/25 bg-[#00d4aa]/10 text-[#00d4aa]">
          <Search className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">Neural scan</h2>
          <p className="mt-1 text-sm text-slate-400">Enter a Solana mint address to fetch intelligence.</p>
        </div>
      </div>

      <form className="mt-6" onSubmit={onSubmit} noValidate>
        <label htmlFor="mint-scanner-input" className="text-xs font-medium uppercase tracking-widest text-slate-500">
          Mint address
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            id="mint-scanner-input"
            name="mint"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            disabled={scanning}
            aria-invalid={showValidation || Boolean(scanError)}
            aria-describedby={
              [showValidation ? validationErrorId : '', scanError ? scanErrorId : ''].filter(Boolean).join(' ') ||
              undefined
            }
            className="h-12 min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950 px-4 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#00d4aa]/50 focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20 focus-visible:ring-2 focus-visible:ring-[#00d4aa]/20"
          />
          <button
            type="submit"
            disabled={scanning || !trimmed || !isValidSolanaMint(trimmed)}
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-[#00d4aa] px-6 font-semibold text-slate-950 transition-colors hover:bg-[#00d4aa]/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:min-w-[120px]"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden />
                Scanning
              </>
            ) : (
              'Scan'
            )}
          </button>
        </div>

        {showValidation ? (
          <p id={validationErrorId} role="alert" className="mt-2 text-sm text-rose-300/95">
            Enter a valid Solana mint address (base58, on-curve).
          </p>
        ) : null}

        {scanError ? (
          <p id={scanErrorId} role="alert" className="mt-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300/95">
            {scanError}
          </p>
        ) : null}
      </form>

      <IntelReportCards />

      <div className="mt-10 border-t border-white/[0.06] pt-8">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recent scans</h3>
        {state.history.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No scans yet — run one above.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {state.history.map((entry) => (
              <li
                key={`${entry.scanId}-${entry.at}`}
                className="flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-slate-950/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-200">{shortMint(entry.mint)}</p>
                  <p className="mt-0.5 text-[0.65rem] text-slate-500">
                    <span className="sr-only">Scan id </span>
                    {entry.scanId.slice(0, 8)}…
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                  {entry.verdict != null ? (
                    <span className={`text-xs font-semibold uppercase tracking-wide ${verdictTone(entry.verdict)}`}>
                      {entry.verdict}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                  {entry.riskScore != null ? (
                    <span className="tabular-nums text-xs text-slate-400">Score {entry.riskScore}</span>
                  ) : null}
                  <span className="text-xs text-slate-500">{formatRelativeTime(entry.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
