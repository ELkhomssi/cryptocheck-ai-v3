'use client'

import { AnimatedCounter } from './AnimatedCounter'
import type { MarketStatusMetric } from '@/lib/trading-terminal/market-intelligence'

type Props = {
  metrics: MarketStatusMetric[]
  methodNote?: string
}

export function MarketIntelStatusBar({ metrics, methodNote }: Props) {
  return (
    <div className="mi-status-bar flex shrink-0 items-stretch gap-0 overflow-x-auto border-b border-[var(--tit-border)] bg-[rgba(11,17,24,0.85)] backdrop-blur-md">
      {metrics.map((m) => (
        <div
          key={m.id}
          className="flex min-w-[7.5rem] flex-1 flex-col justify-center border-r border-[var(--tit-border-subtle)] px-3 py-2.5 last:border-r-0"
        >
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="tit-label !text-[8px]">{m.label}</span>
            {m.sample ? <span className="tit-sample-tag">Sample</span> : null}
          </div>
          <div className="flex items-baseline gap-1.5">
            <AnimatedCounter
              value={m.valueNum}
              decimals={m.decimals ?? 0}
              prefix={m.prefix}
              className="tit-mono text-[0.95rem] font-bold text-[var(--tit-text-0)]"
            />
            {m.suffix ? (
              <span className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">{m.suffix}</span>
            ) : null}
          </div>
          {m.changePct != null ? (
            <span
              className={`tit-mono text-[0.58rem] font-semibold ${
                m.changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
              }`}
            >
              {m.changePct >= 0 ? '+' : ''}
              {m.changePct.toFixed(2)}%
            </span>
          ) : (
            <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">24h</span>
          )}
        </div>
      ))}
      {methodNote ? (
        <div className="hidden shrink-0 items-center px-3 xl:flex">
          <span className="tit-mono text-[0.48rem] uppercase tracking-[0.1em] text-[var(--tit-text-2)]">
            {methodNote}
          </span>
        </div>
      ) : null}
    </div>
  )
}
