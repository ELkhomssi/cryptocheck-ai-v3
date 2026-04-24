'use client'

import { useEffect, useState } from 'react'
import { computeRisk, type ScanData } from '@/lib/helius'
import { GlassCard } from '../shared/GlassCard'
import { Radar } from 'lucide-react'

export function RiskMonitorPanel({ mint }: { mint: string }) {
  const [scan, setScan] = useState<ScanData | null>(null)
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
        const res = await fetch('/api/solana/scan-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint }),
        })
        const json = (await res.json()) as ScanData
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

  const risk = scan ? computeRisk(scan) : null

  return (
    <GlassCard title="Risk Monitor" badge="Sentinel">
      {loading ? (
        <div className="flex items-center gap-3 py-4 font-mono-terminal text-sm text-slate-400">
          <Radar className="h-5 w-5 shrink-0 animate-pulse text-cyan-400/80" aria-hidden />
          Sentinel is ingesting chain state…
        </div>
      ) : !risk ? (
        <p className="py-2 text-base text-slate-500">Awaiting scan data for this mint.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-950/90 to-cyan-950/20 p-4">
            <p className="font-space text-lg font-bold text-white">{risk.verdict}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{risk.summary}</p>
          </div>
          <div className="flex flex-wrap gap-3 font-mono-terminal text-sm">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-200">
              Score <span className="font-bold text-white">{risk.score}</span> / 100
            </div>
            <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-2 text-fuchsia-100">
              Label <span className="font-bold uppercase">{risk.riskLabel}</span>
            </div>
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-cyan-100">
              Model conf. <span className="font-bold">{risk.conf}%</span>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  )
}
