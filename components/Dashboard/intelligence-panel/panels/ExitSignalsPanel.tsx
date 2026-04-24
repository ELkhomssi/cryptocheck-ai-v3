'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '../shared/GlassCard'

type ExitSignal = { mint: string; ai_reasoning: string; generated_at: string; verdict: string }

export function ExitSignalsPanel() {
  const [items, setItems] = useState<ExitSignal[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from('intelligence_signals')
        .select('mint,ai_reasoning,generated_at,verdict')
        .in('signal_type', ['exit', 'caution'])
        .order('generated_at', { ascending: false })
        .limit(12)
      if (active) setItems((data as ExitSignal[]) ?? [])
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <GlassCard title="Exit Signals" badge={`${items.length} recent`}>
      <p className="mb-2 text-xs text-amber-300">Signal-only alerts. User decides and executes independently.</p>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No exit signals detected.</p>
        ) : (
          items.map((item, idx) => (
            <div key={`${item.mint}-${idx}`} className="rounded border border-amber-500/20 p-2">
              <div className="text-xs text-slate-200">Exit signal fired for ${item.mint.slice(0, 4)}</div>
              <div className="text-xs text-slate-400 line-clamp-2">{item.ai_reasoning}</div>
              <a
                className="mt-1 inline-block text-xs text-cyan-300 hover:underline"
                href={`https://jup.ag/swap/${item.mint}-SOL`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Jupiter →
              </a>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}
