'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '../shared/GlassCard'

type Wallet = {
  address: string
  label: string | null
  tier: 'whale' | 'smart_money' | 'insider'
  historical_pnl_usd: number
  last_active_at: string | null
}

export function WhaleTrackerPanel({ mint }: { mint: string }) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [flowCount, setFlowCount] = useState(0)

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

  return (
    <GlassCard title="Whale Tracker (Top 50)" badge={`mint flow: ${flowCount}`}>
      <div className="max-h-52 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1">Wallet</th>
              <th>Tier</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr
                key={w.address}
                className="cursor-pointer border-t border-slate-800/70 text-slate-200"
                onClick={() => setExpanded((prev) => (prev === w.address ? null : w.address))}
              >
                <td className="py-1">{w.label ?? `${w.address.slice(0, 6)}...`}</td>
                <td>{w.tier}</td>
                <td>${Math.round(Number(w.historical_pnl_usd ?? 0)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {current && (
        <div className="mt-3 rounded border border-slate-700 p-2 text-xs text-slate-300">
          <div>{current.address}</div>
          <div>Last active: {current.last_active_at ? new Date(current.last_active_at).toLocaleString() : 'unknown'}</div>
          <div className="text-slate-400">Recent whale activity details appear here for selected wallet.</div>
        </div>
      )}
    </GlassCard>
  )
}
