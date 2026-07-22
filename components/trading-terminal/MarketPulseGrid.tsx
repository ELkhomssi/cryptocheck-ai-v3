'use client'

import { AlertTriangle, Droplets, Fish, Flame, ShieldAlert, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatedCounter } from './AnimatedCounter'
import type { MarketPulseCard } from '@/lib/trading-terminal/market-intelligence'

const ICONS: Record<string, LucideIcon> = {
  new_tokens: Sparkles,
  high_risk: ShieldAlert,
  whale_tx: Fish,
  liq_added: Droplets,
  liq_removed: Droplets,
  rug_alerts: Flame,
}

function toneClass(tone: MarketPulseCard['tone']): string {
  if (tone === 'pos') return 'text-[var(--tit-pos)]'
  if (tone === 'neg') return 'text-[var(--tit-neg)]'
  if (tone === 'warn') return 'text-[var(--tit-warn)]'
  if (tone === 'info') return 'text-[var(--tit-info)]'
  return 'text-[var(--tit-text-1)]'
}

function toneGlow(tone: MarketPulseCard['tone']): string {
  if (tone === 'pos') return 'shadow-[0_0_24px_rgba(0,230,118,0.08)]'
  if (tone === 'neg') return 'shadow-[0_0_24px_rgba(255,82,82,0.08)]'
  if (tone === 'warn') return 'shadow-[0_0_24px_rgba(255,200,87,0.08)]'
  if (tone === 'info') return 'shadow-[0_0_24px_rgba(41,182,246,0.08)]'
  return ''
}

type Props = {
  cards: MarketPulseCard[]
}

export function MarketPulseGrid({ cards }: Props) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 px-3 py-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const Icon = ICONS[c.id] ?? AlertTriangle
        const isUsd = c.display.startsWith('$')
        return (
          <article
            key={c.id}
            className={`tit-panel group relative overflow-hidden p-3 transition-all duration-[var(--tit-motion)] hover:border-[var(--tit-border-strong)] ${toneGlow(c.tone)}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="tit-section-title !normal-case !tracking-[0.06em]">{c.label}</p>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] ${toneClass(c.tone)}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
            </div>
            <p className={`tit-mono text-[1.35rem] font-bold leading-none ${toneClass(c.tone)}`}>
              {isUsd ? (
                c.display
              ) : c.valueNum > 0 || c.display !== '—' ? (
                <AnimatedCounter value={c.valueNum} decimals={0} />
              ) : (
                '—'
              )}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">
                {c.deltaLabel ?? ''}
              </span>
              {c.sample ? <span className="tit-sample-tag">Sample</span> : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
