'use client'

import { useCallback, useState } from 'react'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { ScoreRing } from './ScoreRing'
import { DotMeter } from './DotMeter'
import { scanResultToFactors, verdictLabel } from '@/lib/command-center/scan-factors'

type Props = {
  scan: ScanResult | null
  scanning: boolean
  onScanMint: (mint: string) => void
}

export function AiTokenScannerPanel({ scan, scanning, onScanMint }: Props) {
  const [mintInput, setMintInput] = useState('')

  const submit = useCallback(() => {
    const m = mintInput.trim()
    if (m.length >= 32) onScanMint(m)
  }, [mintInput, onScanMint])

  const factors = scan ? scanResultToFactors(scan) : null

  return (
    <section className="cc-panel p-4">
      <header className="mb-4">
        <p className="cc-label text-[var(--cc-green)]">AI Token Scanner</p>
        <p className="text-[0.65rem] text-[var(--cc-lo)]">Powered by Neural V4</p>
      </header>

      {scanning ? (
        <div className="flex flex-col items-center py-8">
          <div className="h-32 w-32 rounded-full cc-shimmer" aria-busy="true" />
          <p className="mt-4 text-xs text-[var(--cc-mid)]">Scanning on-chain intelligence…</p>
        </div>
      ) : scan ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center">
            <ScoreRing score={scan.safetyScore} max={100} size={120} stroke={8} />
            <p className="cc-mono mt-2 text-xs text-[var(--cc-lo)]">/ 100</p>
            <p className="cc-mono mt-1 text-[0.62rem] uppercase text-[var(--cc-mid)]">{scan.verdict}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-[var(--cc-green)]">{verdictLabel(scan.verdict)}</p>
            <p className="mt-1 text-xs text-[var(--cc-mid)]">{scan.symbol} · {scan.evidenceLine.slice(0, 80)}</p>
            <div className="mt-4 space-y-0.5 border-t border-[var(--cc-inner)] pt-3">
              {factors?.map((f) => (
                <DotMeter key={f.label} label={f.label} filled={f.filled} status={f.status} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-center">
          <ScoreRing score={0} max={100} size={100} stroke={6} />
          <p className="mt-4 text-sm text-[var(--cc-mid)]">Scan any Solana token to see Neural V4 verdict</p>
          <p className="mt-1 text-xs text-[var(--cc-lo)]">Or click Scan on a hot opportunity row</p>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          placeholder="Paste Solana mint address…"
          className="cc-mono w-full rounded-lg border border-[var(--cc-inner)] bg-[var(--cc-panel-2)] px-3 py-2 text-xs text-[var(--cc-hi)] placeholder:text-[var(--cc-lo)]"
          aria-label="Token mint address"
        />
        <button
          type="button"
          onClick={submit}
          disabled={scanning || mintInput.trim().length < 32}
          className="w-full rounded-lg bg-[var(--cc-green)] py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--cc-bg)] disabled:opacity-40"
        >
          Scan Any Token
        </button>
      </div>
    </section>
  )
}
