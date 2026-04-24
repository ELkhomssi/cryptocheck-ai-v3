'use client'

import { useEffect, useState } from 'react'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'

type Level = { price: number; size: number }

export function OrderDepthPanel({ mint }: { mint: string }) {
  const [bids, setBids] = useState<Level[]>([])
  const [asks, setAsks] = useState<Level[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`, { cache: 'no-store' })
        const j = (await res.json()) as { data?: Record<string, { price?: number }> }
        const px = Number(j?.data?.[mint]?.price ?? 0)
        const build = (dir: 'bid' | 'ask'): Level[] =>
          Array.from({ length: 8 }).map((_, i) => ({
            price: Number((px * (dir === 'bid' ? 1 - i * 0.002 : 1 + i * 0.002)).toFixed(6)),
            size: Math.max(1, 10 - i) * 1000,
          }))
        if (active) {
          setBids(build('bid'))
          setAsks(build('ask'))
        }
      } catch {
        if (active) {
          setBids([])
          setAsks([])
        }
      }
    }
    if (mint?.length >= 32) void load()
    return () => {
      active = false
    }
  }, [mint])

  return (
    <NeonForensicPanel title="Order Depth" badge="Jupiter ref" tone="neutral">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="mb-2 font-space text-xs font-bold uppercase tracking-widest text-cyan-300">Bids</h4>
          {bids.map((l, i) => (
            <div key={`b-${i}`} className="flex justify-between gap-2 py-1 font-mono-terminal text-sm text-slate-200">
              <span className="text-cyan-100/90">{l.price}</span>
              <span className="text-slate-400">{l.size.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div>
          <h4 className="mb-2 font-space text-xs font-bold uppercase tracking-widest text-amber-300">Asks</h4>
          {asks.map((l, i) => (
            <div key={`a-${i}`} className="flex justify-between gap-2 py-1 font-mono-terminal text-sm text-slate-200">
              <span className="text-amber-100/90">{l.price}</span>
              <span className="text-slate-400">{l.size.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </NeonForensicPanel>
  )
}
