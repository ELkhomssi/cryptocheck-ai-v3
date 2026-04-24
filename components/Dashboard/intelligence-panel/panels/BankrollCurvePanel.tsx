'use client'

import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { GlassCard } from '../shared/GlassCard'

type PerfRow = { created_at: string; pnl_pct: number | null }

export function BankrollCurvePanel() {
  const [rows, setRows] = useState<PerfRow[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from('signal_performance')
        .select('created_at,pnl_pct')
        .order('created_at', { ascending: true })
        .limit(200)
      if (active) setRows((data as PerfRow[]) ?? [])
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const curve = useMemo(() => {
    let cumulative = 0
    return rows.map((r) => {
      cumulative += Number(r.pnl_pct ?? 0)
      return { t: new Date(r.created_at).toLocaleDateString(), v: Number(cumulative.toFixed(2)) }
    })
  }, [rows])

  return (
    <GlassCard title="Strategy Performance (Historical Signals)">
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve}>
            <XAxis dataKey="t" hide />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="v" stroke="#00D4AA" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Backtest of past signals. Past performance does not predict future results.
      </p>
    </GlassCard>
  )
}
