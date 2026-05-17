'use client'

import { Zap } from 'lucide-react'
import { ageLabel, fmtCompact, shortMint } from '../terminal-utils'
import type { TokenCard } from '../terminal-types'
import { TokenAvatar } from './TokenAvatar'

function TrenchColumn({
  title,
  coins,
  onOpen,
  onQuickBuy,
}: {
  title: string
  coins: TokenCard[]
  onOpen: (mint: string) => void
  onQuickBuy: (mint: string) => void
}) {
  return (
    <div className="flex min-h-[400px] flex-col rounded-xl border border-[#1f1f1f] bg-[#0d0d0d]">
      <div className="border-b border-[#1f1f1f] px-4 py-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-[0.65rem] text-white/40">{coins.length} coins</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '70vh' }}>
        {coins.map((coin) => (
          <article
            key={coin.id}
            className="flex items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#141414] p-2 transition hover:border-[#22c55e]/30"
          >
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
                <p className="text-[0.55rem] text-white/40">{ageLabel(coin.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs font-bold text-white">{fmtCompact(coin.marketCap)}</p>
                <p className="text-[0.55rem] text-white/40">V {fmtCompact(coin.volumeSol * 168)}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onQuickBuy(coin.mint)}
              className="shrink-0 rounded-lg bg-[#22c55e] px-2 py-1.5 text-[0.65rem] font-bold text-black"
              aria-label={`Quick buy ${coin.ticker}`}
            >
              <Zap className="mx-auto h-3.5 w-3.5" />
            </button>
          </article>
        ))}
        {coins.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/30">Empty</p>
        ) : null}
      </div>
    </div>
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
      <TrenchColumn title="New" coins={trenches.new} onOpen={onOpen} onQuickBuy={onQuickBuy} />
      <TrenchColumn title="Soon" coins={trenches.soon} onOpen={onOpen} onQuickBuy={onQuickBuy} />
      <TrenchColumn title="Migrated" coins={trenches.migrated} onOpen={onOpen} onQuickBuy={onQuickBuy} />
    </div>
  )
}
