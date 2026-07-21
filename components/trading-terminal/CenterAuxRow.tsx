'use client'

import { useMemo, useState, useEffect } from 'react'
import { loadTradeLog } from '@/lib/trading-terminal/trade-log'
import { summarizeOutcomes, computeTradeOutcome } from '@/lib/trading-terminal/trade-outcomes'
import { SniperArmPanel } from './SniperArmPanel'

function TradeMarksSummary() {
  const [tick, setTick] = useState(0)
  const summary = useMemo(() => {
    void tick
    const trades = loadTradeLog()
    const outcomes = trades.map((t) => computeTradeOutcome(t, t.entryPriceUsd ?? null))
    const s = summarizeOutcomes(outcomes)
    const wins = outcomes.filter(
      (o) => o.status === 'marked' && o.priceDeltaPct != null && o.priceDeltaPct > 0,
    ).length
    const marked = s.marked
    const best = outcomes.reduce<number | null>((acc, o) => {
      if (o.priceDeltaPct == null) return acc
      return acc == null ? o.priceDeltaPct : Math.max(acc, o.priceDeltaPct)
    }, null)
    const worst = outcomes.reduce<number | null>((acc, o) => {
      if (o.priceDeltaPct == null) return acc
      return acc == null ? o.priceDeltaPct : Math.min(acc, o.priceDeltaPct)
    }, null)
    return {
      count: trades.length,
      marked,
      winRate: marked > 0 ? (wins / marked) * 100 : null,
      avg: s.avgDeltaPct,
      best,
      worst,
      unavailable: s.unavailable,
    }
  }, [tick])

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="tit-panel-flat flex h-full flex-col justify-center gap-1 px-3 py-1.5">
      <div className="flex items-center justify-between">
        <p className="tit-label">Trade Marks</p>
        <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">confirmed fills</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <MarkStat label="Marked" value={String(summary.count)} />
        <MarkStat
          label="Win rate"
          value={summary.winRate != null ? `${summary.winRate.toFixed(1)}%` : null}
        />
        <MarkStat
          label="Avg Δ"
          value={summary.avg != null ? `${summary.avg >= 0 ? '+' : ''}${summary.avg.toFixed(1)}%` : null}
          tone={summary.avg == null ? undefined : summary.avg >= 0 ? 'pos' : 'neg'}
        />
        <MarkStat
          label="Best"
          value={summary.best != null ? `+${summary.best.toFixed(1)}%` : null}
          tone="pos"
        />
        <MarkStat
          label="Worst"
          value={summary.worst != null ? `${summary.worst.toFixed(1)}%` : null}
          tone="neg"
        />
      </div>
    </div>
  )
}

function MarkStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string | null
  tone?: 'pos' | 'neg'
}) {
  return (
    <div>
      <p className="tit-label !text-[8px]">{label}</p>
      <p
        className={`tit-mono text-[0.7rem] font-semibold ${
          tone === 'pos'
            ? 'text-[var(--tit-pos)]'
            : tone === 'neg'
              ? 'text-[var(--tit-neg)]'
              : 'text-[var(--tit-text-0)]'
        }`}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

/** Sniper + Trade Marks under chart workspace. */
export function CenterAuxRow() {
  return (
    <div className="grid h-[72px] grid-cols-2 gap-1">
      <SniperArmPanel compact />
      <TradeMarksSummary />
    </div>
  )
}
