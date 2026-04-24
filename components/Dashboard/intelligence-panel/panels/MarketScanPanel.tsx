'use client'

import { useEffect, useState } from 'react'
import { computeRisk, type ScanData } from '@/lib/helius'
import { GlassCard } from '../shared/GlassCard'
import { supabase } from '@/lib/supabase'

export function MarketScanPanel({ mint }: { mint: string }) {
  const [scan, setScan] = useState<ScanData | null>(null)
  const [tracking, setTracking] = useState(false)

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
    <GlassCard title="Market Scan">
      <div className="space-y-2 text-xs">
        <div className="font-mono text-slate-300">Mint: {mint.slice(0, 6)}...{mint.slice(-4)}</div>
        <div className="text-slate-400">Using existing scan engine (no auto-trade path).</div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2 text-slate-200">
          Verdict: {risk?.verdict ?? 'Scanning...'}
        </div>
        <button
          type="button"
          disabled={tracking}
          onClick={async () => {
            setTracking(true)
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser()
              if (!user) return
              await supabase
                .from('tracked_opportunities')
                .upsert({ user_id: user.id, mint }, { onConflict: 'user_id,mint' })
            } finally {
              setTracking(false)
            }
          }}
          className="rounded border border-cyan-500/30 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
        >
          {tracking ? 'Tracking...' : 'Track this token'}
        </button>
      </div>
    </GlassCard>
  )
}
