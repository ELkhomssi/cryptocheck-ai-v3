'use client'

import { useEffect, useState } from 'react'
import { GlassCard } from '../shared/GlassCard'

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
    <GlassCard title="Order Depth">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <h4 className="mb-1 text-cyan-300">Bids</h4>
          {bids.map((l, i) => (
            <div key={`b-${i}`} className="flex justify-between text-slate-300">
              <span>{l.price}</span>
              <span>{l.size.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div>
          <h4 className="mb-1 text-amber-300">Asks</h4>
          {asks.map((l, i) => (
            <div key={`a-${i}`} className="flex justify-between text-slate-300">
              <span>{l.price}</span>
              <span>{l.size.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}
