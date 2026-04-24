'use client'

import { useEffect, useState } from 'react'
import { GlassCard } from '../shared/GlassCard'
import { SignalBadge } from '../shared/SignalBadge'

type SignalResponse = {
  verdict: string
  summary: string
  confidencePct: number
  observations?: unknown[]
  whaleCount?: number
  disclaimer?: string
}

export function AISignalPanel({ mint }: { mint: string }) {
  const [data, setData] = useState<SignalResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function run() {
      try {
        setError('')
        const res = await fetch(`/api/v1/intelligence/signals/${mint}`, { cache: 'no-store' })
        const json = (await res.json()) as SignalResponse & { error?: string }
        if (!active) return
        if (!res.ok) {
          setError(json.error ?? 'Intelligence unavailable')
          return
        }
        setData(json)
      } catch {
        if (active) setError('Intelligence unavailable')
      }
    }
    if (mint?.length >= 32) void run()
    return () => {
      active = false
    }
  }, [mint])

  return (
    <GlassCard title="AI Signal Panel" badge="Consensus">
      {error ? (
        <p className="text-sm text-amber-300">{error}</p>
      ) : !data ? (
        <p className="text-sm text-slate-400">Analyzing on-chain observations...</p>
      ) : (
        <div className="space-y-3">
          <SignalBadge verdict={data.verdict} />
          <p className="text-sm text-slate-200">{data.summary}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>Data quality: {data.confidencePct}%</div>
            <div>Whales observed: {data.whaleCount ?? 0}</div>
            <div>Observations: {data.observations?.length ?? 0}</div>
            <div className="text-slate-500">Signal-only intelligence</div>
          </div>
          <p className="text-xs text-amber-300">
            {data.disclaimer ?? 'Informational only. Not financial advice. Do your own research.'}
          </p>
        </div>
      )}
    </GlassCard>
  )
}
