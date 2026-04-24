'use client'

import { useEffect, useState } from 'react'
import { computeRisk, type ScanData } from '@/lib/helius'
import { GlassCard } from '../shared/GlassCard'

export function RiskMonitorPanel({ mint }: { mint: string }) {
  const [scan, setScan] = useState<ScanData | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch('/api/solana/scan-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint }),
        })
        const json = (await res.json()) as ScanData
        if (active && res.ok) setScan(json)
      } catch {
        if (active) setScan(null)
      }
    }
    if (mint?.length >= 32) void load()
    return () => {
      active = false
    }
  }, [mint])

  const risk = scan ? computeRisk(scan) : null

  return (
    <GlassCard title="Risk Monitor" badge="Sentinel">
      {!risk ? (
        <p className="text-sm text-slate-400">Loading Sentinel risk observations...</p>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-200">{risk.verdict}</div>
          <div className="text-xs text-slate-400">{risk.summary}</div>
          <div className="text-xs text-slate-300">Score: {risk.score} / 100</div>
        </div>
      )}
    </GlassCard>
  )
}
