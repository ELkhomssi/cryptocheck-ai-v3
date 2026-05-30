'use client'

import { ageLabel, fmtCompact } from '../terminal-utils'
import type { DiscoverFilter, TokenCard } from '../terminal-types'
import { Panel } from './terminal-primitives'
import { TokenAvatar } from './TokenAvatar'

const FILTERS: { id: DiscoverFilter; label: string }[] = [
  { id: 'movers', label: 'Movers' },
  { id: 'live', label: 'Live' },
  { id: 'new', label: 'New' },
  { id: 'mayhem', label: 'Hot' },
  { id: 'migrated', label: 'Graduated' },
]

export function DiscoverView({
  cards,
  filter,
  onFilter,
  onOpen,
  onQuickBuy,
}: {
  cards: TokenCard[]
  filter: DiscoverFilter
  onFilter: (f: DiscoverFilter) => void
  onOpen: (mint: string) => void
  onQuickBuy: (mint: string) => void
}) {
  const trending = [...cards].sort((a, b) => b.marketCap - a.marketCap).slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      {trending.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[#ccc]">Trending</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {trending.map((coin) => (
              <button
                key={coin.id}
                type="button"
                onClick={() => onOpen(coin.mint)}
                className="web4-panel flex min-w-[140px] shrink-0 flex-col p-3 text-left transition hover:border-[#3a3a3a]"
              >
                <TokenAvatar coin={coin} size="sm" />
                <p className="mt-2 truncate text-sm font-semibold text-white">${coin.ticker}</p>
                <p className="text-sm tabular-nums text-white">{fmtCompact(coin.marketCap)}</p>
                <p
                  className={`mt-0.5 text-xs tabular-nums ${
                    coin.change24h >= 0 ? 'text-[#86efac]' : 'text-[#f87171]'
                  }`}
                >
                  {coin.change24h >= 0 ? '+' : ''}
                  {coin.change24h.toFixed(1)}%
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-[#ccc]">Coins</h2>
          <div className="ml-auto flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilter(f.id)}
                className="web4-filter-pill"
                data-active={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {cards.map((coin) => (
            <article key={coin.id} className="web4-coin-card group relative">
              <button type="button" onClick={() => onOpen(coin.mint)} className="block w-full text-left">
                <div
                  className={`flex h-28 items-center justify-center bg-gradient-to-br ${coin.gradient} text-4xl`}
                >
                  {coin.emoji}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{coin.name}</p>
                      <p className="text-xs text-[#888]">${coin.ticker}</p>
                    </div>
                    {coin.graduated ? (
                      <span className="shrink-0 rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] text-[#888]">
                        Grad
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-medium tabular-nums text-white">
                    {fmtCompact(coin.marketCap)}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#2a2a2a]">
                    <div
                      className="h-full bg-[#86efac]"
                      style={{ width: `${Math.min(100, coin.progress)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#666]">
                    {coin.graduated ? 'Raydium' : `${coin.progress.toFixed(0)}% · ${ageLabel(coin.createdAt)}`}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickBuy(coin.mint)
                }}
                className="web4-btn-buy absolute right-2 top-2 px-2 py-1 text-[11px] font-semibold opacity-0 transition group-hover:opacity-100"
              >
                0.1 SOL
              </button>
            </article>
          ))}
        </div>

        {cards.length === 0 ? (
          <Panel className="py-16 text-center text-sm text-[#666]">
            No coins match this filter.
          </Panel>
        ) : null}
      </section>
    </div>
  )
}
