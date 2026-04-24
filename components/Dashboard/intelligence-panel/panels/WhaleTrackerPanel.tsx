'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '../shared/GlassCard'
import { Activity, Fish } from 'lucide-react'

type Wallet = {
  address: string
  label: string | null
  tier: 'whale' | 'smart_money' | 'insider'
  historical_pnl_usd: number
  last_active_at: string | null
}

function tierChip(tier: Wallet['tier']): { label: string; className: string } {
  switch (tier) {
    case 'smart_money':
      return {
        label: 'SMART',
        className:
          'border-emerald-400/40 bg-gradient-to-r from-emerald-500/25 to-cyan-500/15 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
      }
    case 'insider':
      return {
        label: 'INSIDER',
        className:
          'border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-500/25 to-rose-500/15 text-fuchsia-100 shadow-[0_0_12px_rgba(217,70,239,0.2)]',
      }
    default:
      return {
        label: 'WHALE',
        className:
          'border-cyan-400/40 bg-gradient-to-r from-cyan-500/25 to-slate-600/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.2)]',
      }
  }
}

function logStamp(iso: string | null): string {
  if (!iso) return '— —:--:-- UTC'
  try {
    const d = new Date(iso)
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  } catch {
    return '—'
  }
}

export function WhaleTrackerPanel({ mint }: { mint: string }) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [flowCount, setFlowCount] = useState(0)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from('smart_money_wallets')
        .select('address,label,tier,historical_pnl_usd,last_active_at')
        .eq('active', true)
        .order('historical_pnl_usd', { ascending: false })
        .limit(50)
      if (active) setWallets((data as Wallet[]) ?? [])
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadFlow() {
      const res = await fetch(`/api/v1/intelligence/whale-flow/${mint}`, { cache: 'no-store' })
      const j = (await res.json().catch(() => ({ items: [] }))) as { items?: unknown[] }
      if (active) setFlowCount(j.items?.length ?? 0)
    }
    if (mint?.length >= 32) void loadFlow()
    return () => {
      active = false
    }
  }, [mint])

  const current = useMemo(() => wallets.find((w) => w.address === expanded), [expanded, wallets])
  const ingestLine = useMemo(() => new Date(nowTick).toISOString().replace('T', ' ').slice(0, 19), [nowTick])

  return (
    <GlassCard title="Whale Tracker" badge={`Mint flow · ${flowCount}`}>
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-3 font-mono-terminal text-xs text-slate-500">
        <Activity className="h-3.5 w-3.5 text-emerald-400/80" aria-hidden />
        <span>
          FORENSIC_LOG · stream_id <span className="text-cyan-400/90">whale_top50</span> · ingest {ingestLine}
        </span>
      </div>

      <div className="max-h-60 space-y-1 overflow-auto pr-1">
        {wallets.map((w, i) => {
          const chip = tierChip(w.tier)
          const short = w.label ?? `${w.address.slice(0, 4)}…${w.address.slice(-4)}`
          return (
            <motion.button
              type="button"
              key={w.address}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.45), duration: 0.35, ease: 'easeOut' }}
              onClick={() => setExpanded((prev) => (prev === w.address ? null : w.address))}
              className={`
                flex w-full flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition
                ${expanded === w.address ? 'border-fuchsia-400/35 bg-fuchsia-500/10' : 'border-white/[0.06] bg-slate-950/50 hover:border-cyan-500/25 hover:bg-slate-900/70'}
              `}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Fish className="h-3.5 w-3.5 shrink-0 text-cyan-400/70" aria-hidden />
                <span className="font-mono-terminal text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  [{logStamp(w.last_active_at)}]
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono-terminal text-[10px] font-bold uppercase tracking-wider ${chip.className}`}
                >
                  {chip.label}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono-terminal text-sm font-bold text-slate-100">{short}</span>
                <span className="font-mono-terminal text-sm font-semibold text-emerald-300/90">
                  PnL ${Math.round(Number(w.historical_pnl_usd ?? 0)).toLocaleString()}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {current ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-2 rounded-xl border border-cyan-500/25 bg-[#020617]/90 p-4 font-mono-terminal text-sm text-slate-300"
        >
          <div className="text-xs uppercase tracking-widest text-fuchsia-400/80">Selected record</div>
          <div className="break-all text-xs leading-relaxed text-cyan-100/90">{current.address}</div>
          <div className="text-xs text-slate-500">
            Last active:{' '}
            {current.last_active_at ? new Date(current.last_active_at).toLocaleString() : 'unknown'}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            On-chain flow for the active mint is summarized in the mint flow badge. Expand another row to compare
            wallets.
          </p>
        </motion.div>
      ) : null}
    </GlassCard>
  )
}
