'use client'

import { useCallback, useState } from 'react'
import { Shield } from 'lucide-react'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { scanResultToFactors, verdictLabel } from '@/lib/command-center/scan-factors'
import { ScoreRing } from './primitives/ScoreRing'
import { SectionHeader } from './primitives/SectionHeader'
import { FactorRow } from './FactorRow'

export type AITokenScannerPanelProps = {
  scan: ScanResult | null
  scanning: boolean
  onScanMint: (mint: string) => void
}

function toneFromWord(word: string): 'good' | 'mid' | 'bad' {
  if (['Low', 'Safe', 'Strong', 'Good'].includes(word)) return 'good'
  if (word === 'Moderate') return 'mid'
  return 'bad'
}

export function AITokenScannerPanel({ scan, scanning, onScanMint }: AITokenScannerPanelProps) {
  const [mintInput, setMintInput] = useState('')

  const submit = useCallback(() => {
    const m = mintInput.trim()
    if (m.length >= 32) onScanMint(m)
  }, [mintInput, onScanMint])

  const factors = scan ? scanResultToFactors(scan) : null
  const riskWord =
    scan?.verdict === 'SAFE' ? 'Low Risk' : scan?.verdict === 'CAUTION' ? 'Moderate Risk' : 'High Risk'

  return (
    <section className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
      <SectionHeader icon={Shield} title="AI TOKEN SCANNER" subtitle="Powered by Neural V4" />

      {scanning ? (
        <div className="flex flex-col items-center py-8">
          <div className="h-[110px] w-[110px] animate-shimmer rounded-full bg-dash-panel2" />
          <p className="mt-4 text-xs text-dash-tmid">Scanning on-chain intelligence…</p>
        </div>
      ) : scan ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center">
            <ScoreRing value={scan.safetyScore} size={110} stroke={6} />
            <p className="font-dash-mono mt-1 text-[11px] text-dash-tlo">/100</p>
            <p className="font-dash-mono text-[11px] uppercase text-dash-tmid">{riskWord}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-dash-tlo">AI Verdict</p>
            <p className="text-base font-semibold text-dash-thi">{verdictLabel(scan.verdict)}</p>
            <div className="mt-3 border-t border-dash-innerline pt-2">
              {factors?.map((f) => (
                <FactorRow
                  key={f.label}
                  name={f.label}
                  meterLevel={f.filled}
                  word={f.status}
                  tone={toneFromWord(f.status)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center py-6 text-center opacity-70">
          <ScoreRing value={0} size={100} stroke={6} />
          <p className="mt-4 text-sm text-dash-tmid">Scan a token to analyze</p>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          placeholder="Paste Solana mint address…"
          className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
          aria-label="Token mint address"
        />
        <button
          type="button"
          onClick={submit}
          disabled={scanning || mintInput.trim().length < 32}
          className="w-full rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        >
          Scan Any Token
        </button>
      </div>
    </section>
  )
}
