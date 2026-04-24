'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'
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
    <NeonForensicPanel title="Tracked Opportunities" badge={`${items.length} tracked`} tone="neutral">
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="py-2 text-base text-slate-500">No tracked opportunities yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/[0.08] bg-slate-950/60 p-4 shadow-[inset_0_0_24px_rgba(34,211,238,0.04)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono-terminal text-sm font-bold text-cyan-100/90">
                  {item.mint.slice(0, 8)}…{item.mint.slice(-6)}
                </span>
                <SignalBadge verdict={signals[item.mint]?.verdict ?? 'quiet'} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400 line-clamp-2">
                {signals[item.mint]?.ai_reasoning ?? 'Awaiting intelligence update.'}
              </p>
              <a
                href={`https://jup.ag/swap/SOL-${item.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Jupiter swap (user executes) →
              </a>
            </div>
          ))
        )}
      </div>
    </NeonForensicPanel>
  )
}
