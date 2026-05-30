'use client'

import { ageLabel, fmtCompact, shortMint } from '../terminal-utils'
import type { TokenCard } from '../terminal-types'
import { Panel } from './terminal-primitives'
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
    <Panel className="flex min-h-[420px] flex-col overflow-hidden p-0">
      <div className="border-b border-[#2a2a2a] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-[#666]">{coins.length} coins</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
        {coins.map((coin) => (
          <article
            key={coin.id}
            className="rounded-lg border border-[#2a2a2a] bg-[#111] p-2 transition hover:border-[#3a3a3a]"
          >
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => onOpen(coin.mint)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <TokenAvatar coin={coin} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{coin.name}</p>
                  <p className="text-[11px] text-[#888]">
                    ${coin.ticker} · {shortMint(coin.mint)}
                  </p>
                  <p className="text-[10px] text-[#666]">{ageLabel(coin.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium tabular-nums text-white">{fmtCompact(coin.marketCap)}</p>
                  <p className="text-[10px] text-[#666]">Vol {fmtCompact(coin.volumeSol * 168)}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onQuickBuy(coin.mint)}
                className="web4-btn-buy flex w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-semibold"
                aria-label={`Quick buy ${coin.ticker}`}
              >
                0.1
              </button>
            </div>
            <div className="mt-2 px-1">
              <div className="mb-1 flex justify-between text-[10px] text-[#666]">
                <span>Curve</span>
                <span className="tabular-nums text-[#86efac]">{coin.progress.toFixed(0)}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[#2a2a2a]">
                <div
                  className="h-full bg-[#86efac]"
                  style={{ width: `${Math.min(100, coin.progress)}%` }}
                />
              </div>
            </div>
          </article>
        ))}
        {coins.length === 0 ? (
          <p className="py-12 text-center text-xs text-[#666]">Empty</p>
        ) : null}
      </div>
    </Panel>
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
