'use client'

import { useEffect, useState } from 'react'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'
import { Radar } from 'lucide-react'
import type { CanonicalScanResult } from '@/lib/types/canonical-scan'

export function RiskMonitorPanel({ mint }: { mint: string }) {
  const [scan, setScan] = useState<CanonicalScanResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (mint?.length < 32) {
        setScan(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/v1/sentinel/canonical-scan/${mint}`, { cache: 'no-store' })
        const json = (await res.json()) as CanonicalScanResult
        if (active && res.ok) setScan(json)
        else if (active) setScan(null)
      } catch {
        if (active) setScan(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [mint])

  return (
    <NeonForensicPanel title="Risk Monitor" badge="Sentinel" tone="capacity">
      {loading ? (
        <div className="flex items-center gap-3 py-4 font-mono-terminal text-sm text-slate-400">
          <Radar className="h-5 w-5 shrink-0 animate-pulse text-cyan-400/80" aria-hidden />
          Sentinel is ingesting chain state…
        </div>
      ) : !scan ? (
        <p className="py-2 text-base text-slate-500">Awaiting scan data for this mint.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-950/90 to-cyan-950/20 p-4">
            <p className="font-space text-lg font-bold text-white">{scan.verdict}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{scan.verdictReason}</p>
          </div>
          <div className="flex flex-wrap gap-3 font-mono-terminal text-sm">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-200">
              Score <span className="font-bold text-white">{scan.riskScore}</span> / 100
            </div>
            <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-2 text-fuchsia-100">
              Verdict <span className="font-bold uppercase">{scan.verdict}</span>
            </div>
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-cyan-100">
              Liquidity <span className="font-bold">{scan.liquidity.status}</span>
            </div>
          </div>
        </div>
      )}
    </NeonForensicPanel>
  )
}
