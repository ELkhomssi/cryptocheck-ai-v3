'use client'

import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { ageLabel, fmtCompact, shortMint } from '../terminal-utils'
import type { TokenCard } from '../terminal-types'
import { GlassCard } from './terminal-primitives'
import { TokenAvatar } from './TokenAvatar'

function TrenchColumn({
  title,
  coins,
  onOpen,
  onQuickBuy,
  accent,
}: {
  title: string
  coins: TokenCard[]
  onOpen: (mint: string) => void
  onQuickBuy: (mint: string) => void
  accent?: boolean
}) {
  return (
    <GlassCard
      className={`flex min-h-[420px] flex-col overflow-hidden p-0 ${accent ? 'web4-glow-green' : ''}`}
    >
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-[0.65rem] text-white/40">{coins.length} coins</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
        {coins.map((coin) => (
          <article
            key={coin.id}
            className="rounded-xl border border-white/[0.06] bg-black/30 p-2 transition hover:border-[#22c55e]/35"
          >
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => onOpen(coin.mint)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <TokenAvatar coin={coin} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{coin.name}</p>
                  <p className="font-mono text-[0.6rem] text-[#86efac]">
                    ${coin.ticker} · {shortMint(coin.mint)}
                  </p>
                  <p className="text-[0.55rem] text-white/35">{ageLabel(coin.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs font-bold text-white">{fmtCompact(coin.marketCap)}</p>
                  <p className="text-[0.55rem] text-white/40">V {fmtCompact(coin.volumeSol * 168)}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onQuickBuy(coin.mint)}
                className="web4-btn-primary flex w-12 shrink-0 flex-col items-center justify-center rounded-lg text-black"
                aria-label={`Quick buy ${coin.ticker}`}
              >
                <Zap className="h-4 w-4 fill-current" />
                <span className="mt-0.5 font-mono text-[0.55rem] font-bold">0.1</span>
              </button>
            </div>
            <div className="mt-2 px-1">
              <div className="mb-1 flex justify-between text-[0.55rem] text-white/40">
                <span>Curve</span>
                <span className="font-mono text-[#86efac]">{coin.progress.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#86efac]"
                  initial={false}
                  animate={{ width: `${Math.min(100, coin.progress)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </article>
        ))}
        {coins.length === 0 ? (
          <p className="py-12 text-center text-xs text-white/30">Empty</p>
        ) : null}
      </div>
    </GlassCard>
  )
}

export function TrenchesView({
  trenches,
  onOpen,
  onQuickBuy,
}: {
  trenches: { new: TokenCard[]; soon: TokenCard[]; migrated: TokenCard[] }
  onOpen: (mint: string) => void
  onQuickBuy: (mint: string) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <TrenchColumn title="New" coins={trenches.new} onOpen={onOpen} onQuickBuy={onQuickBuy} accent />
      <TrenchColumn title="Soon" coins={trenches.soon} onOpen={onOpen} onQuickBuy={onQuickBuy} />
      <TrenchColumn title="Migrated" coins={trenches.migrated} onOpen={onOpen} onQuickBuy={onQuickBuy} />
    </div>
  )
}
