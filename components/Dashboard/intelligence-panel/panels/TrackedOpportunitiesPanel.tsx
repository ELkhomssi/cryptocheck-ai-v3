'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '../shared/GlassCard'
import { SignalBadge } from '../shared/SignalBadge'

type Item = { id: string; mint: string; created_at: string }
type Signal = { verdict: string; ai_reasoning: string }

export function TrackedOpportunitiesPanel() {
  const [items, setItems] = useState<Item[]>([])
  const [signals, setSignals] = useState<Record<string, Signal>>({})

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from('tracked_opportunities')
        .select('id,mint,created_at')
        .is('exited_at', null)
        .order('created_at', { ascending: false })
        .limit(20)
      if (!active) return
      const list = (data as Item[]) ?? []
      setItems(list)
      const updates: Record<string, Signal> = {}
      await Promise.all(
        list.map(async (item) => {
          const { data: sig } = await supabase
            .from('intelligence_signals')
            .select('verdict,ai_reasoning')
            .eq('mint', item.mint)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (sig) updates[item.mint] = sig as Signal
        })
      )
      if (active) setSignals(updates)
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <GlassCard title="Tracked Opportunities" badge={`${items.length} tracked`}>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No tracked opportunities yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded border border-slate-800 p-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-200">{item.mint.slice(0, 6)}...{item.mint.slice(-4)}</span>
                <SignalBadge verdict={signals[item.mint]?.verdict ?? 'quiet'} />
              </div>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {signals[item.mint]?.ai_reasoning ?? 'Awaiting intelligence update.'}
              </p>
              <a
                href={`https://jup.ag/swap/SOL-${item.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-cyan-300 hover:underline"
              >
                Jupiter swap (user executes)
              </a>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}
