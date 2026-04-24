'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '../shared/GlassCard'
import { DoorOpen } from 'lucide-react'

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
      <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-relaxed text-amber-100/90">
        Signal-only alerts. You decide execution — no auto-trades from this console.
      </p>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-base text-slate-500">No exit signals in the forensic queue.</p>
        ) : (
          items.map((item, idx) => (
            <motion.div
              key={`${item.mint}-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="rounded-xl border border-rose-500/20 bg-gradient-to-r from-rose-950/40 via-slate-950/80 to-amber-950/20 p-4"
            >
              <div className="flex flex-wrap items-center gap-2 font-mono-terminal text-[11px] uppercase tracking-wider text-slate-500">
                <DoorOpen className="h-3.5 w-3.5 text-rose-400" aria-hidden />
                {new Date(item.generated_at).toISOString().replace('T', ' ').slice(0, 19)} UTC
              </div>
              <div className="mt-2 font-mono-terminal text-sm font-semibold text-slate-100">
                EXIT · {item.mint.slice(0, 6)}…{item.mint.slice(-4)}
              </div>
              <div className="mt-1 font-space text-xs font-bold uppercase tracking-wide text-amber-200/90">
                {item.verdict}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400 line-clamp-3">{item.ai_reasoning}</p>
              <a
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                href={`https://jup.ag/swap/${item.mint}-SOL`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Jupiter →
              </a>
            </motion.div>
          ))
        )}
      </div>
    </GlassCard>
  )
}
