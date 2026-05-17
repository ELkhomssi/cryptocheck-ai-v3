'use client'

import { motion } from 'framer-motion'
import { TrendingUp, Zap } from 'lucide-react'
import { ageLabel, fmtCompact } from '../terminal-utils'
import type { DiscoverFilter, TokenCard } from '../terminal-types'
import { DiscoverHero, GlassCard } from './terminal-primitives'
import { TokenAvatar } from './TokenAvatar'

const FILTERS: { id: DiscoverFilter; label: string }[] = [
  { id: 'movers', label: 'Movers' },
  { id: 'live', label: 'Live' },
  { id: 'new', label: 'New' },
  { id: 'mayhem', label: 'Mayhem' },
  { id: 'migrated', label: 'Graduated' },
]

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export function DiscoverView({
  cards,
  filter,
  onFilter,
  onOpen,
  onQuickBuy,
  onCreate,
}: {
  cards: TokenCard[]
  filter: DiscoverFilter
  onFilter: (f: DiscoverFilter) => void
  onOpen: (mint: string) => void
  onQuickBuy: (mint: string) => void
  onCreate: () => void
}) {
  const trending = [...cards].sort((a, b) => b.marketCap - a.marketCap).slice(0, 5)
  const featured = trending[0]

  return (
    <motion.div className="flex flex-col gap-8" variants={stagger} initial="hidden" animate="show">
      <motion.div variants={item}>
        <DiscoverHero onCreate={onCreate} />
      </motion.div>

      {featured ? (
        <motion.section variants={item}>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#86efac]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">King of the hill</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpen(featured.mint)}
            className="group relative w-full overflow-hidden rounded-2xl text-left"
          >
            <GlassCard glow className="flex flex-col gap-4 p-0 md:flex-row md:items-stretch">
              <motion.div
                className={`flex min-h-[160px] flex-1 items-center justify-center bg-gradient-to-br ${featured.gradient} text-7xl md:min-h-[200px] md:max-w-[280px]`}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                {featured.emoji}
              </motion.div>
              <div className="flex flex-1 flex-col justify-center p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#86efac]">
                  #{1} trending
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white md:text-3xl">
                  {featured.name}{' '}
                  <span className="text-[#86efac]">${featured.ticker}</span>
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-white/45">
                  {featured.description || 'Community-driven bonding curve launch on Web4.fun'}
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-[0.65rem] text-white/40">Market cap</p>
                    <p className="font-mono text-2xl font-bold text-white">
                      {fmtCompact(featured.marketCap)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] text-white/40">24h</p>
                    <p
                      className={`font-mono text-xl font-bold ${
                        featured.change24h >= 0 ? 'text-[#4ade80]' : 'text-red-400'
                      }`}
                    >
                      {featured.change24h >= 0 ? '+' : ''}
                      {featured.change24h.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#22c55e] via-[#86efac] to-[#4ade80]"
                    initial={{ width: 0 }}
                    animate={{ width: `${featured.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </GlassCard>
          </button>
        </motion.section>
      ) : null}

      <motion.section variants={item}>
        <h2 className="mb-3 text-sm font-bold text-white/80">Trending now</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {trending.map((coin, i) => (
            <motion.button
              key={coin.id}
              type="button"
              onClick={() => onOpen(coin.mint)}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="web4-glass flex min-w-[150px] shrink-0 flex-col rounded-xl p-3 text-left transition hover:border-[#22c55e]/30"
            >
              <span className="mb-2 font-mono text-[0.6rem] text-white/35">#{i + 1}</span>
              <TokenAvatar coin={coin} size="sm" />
              <p className="mt-2 truncate text-sm font-bold">${coin.ticker}</p>
              <p className="font-mono text-sm font-bold text-white">{fmtCompact(coin.marketCap)}</p>
              <p
                className={`mt-1 font-mono text-xs ${
                  coin.change24h >= 0 ? 'text-[#4ade80]' : 'text-red-400'
                }`}
              >
                {coin.change24h >= 0 ? '+' : ''}
                {coin.change24h.toFixed(1)}%
              </p>
            </motion.button>
          ))}
        </div>
      </motion.section>

      <motion.section variants={item}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-white/80">Explore coins</h2>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilter(f.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === f.id
                    ? 'bg-[#22c55e] text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          variants={stagger}
        >
          {cards.map((coin) => (
            <motion.article
              key={coin.id}
              variants={item}
              layout
              className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c0c]/80 transition hover:border-[#22c55e]/40 hover:shadow-[0_0_30px_rgba(34,197,94,0.08)]"
            >
              <button type="button" onClick={() => onOpen(coin.mint)} className="block w-full text-left">
                <div
                  className={`relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br ${coin.gradient} text-5xl`}
                >
                  {coin.emoji}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {coin.graduated ? (
                    <span className="absolute left-2 top-2 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[0.55rem] font-bold text-black">
                      GRAD
                    </span>
                  ) : (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[0.55rem] text-[#86efac]">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-[#4ade80]" />
                      LIVE
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-bold text-white">{coin.name}</p>
                  <p className="font-mono text-[0.65rem] text-[#86efac]">${coin.ticker}</p>
                  <p className="mt-1.5 font-mono text-sm font-bold">{fmtCompact(coin.marketCap)}</p>
                  <motion.div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#22c55e] to-[#86efac]"
                      initial={false}
                      animate={{ width: `${Math.min(100, coin.progress)}%` }}
                    />
                  </motion.div>
                  <p className="mt-1.5 text-[0.6rem] text-white/35">
                    {coin.graduated ? 'On Raydium' : `${coin.progress.toFixed(0)}% · ${ageLabel(coin.createdAt)}`}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickBuy(coin.mint)
                }}
                className="web4-btn-primary absolute right-2 top-2 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.65rem] font-bold text-black opacity-0 transition group-hover:opacity-100"
              >
                <Zap className="h-3 w-3 fill-current" />
                0.1 SOL
              </button>
            </motion.article>
          ))}
        </motion.div>
        {cards.length === 0 ? (
          <GlassCard className="py-16 text-center text-sm text-white/40">
            No coins match — try another filter or create one.
          </GlassCard>
        ) : null}
      </motion.section>
    </motion.div>
  )
}
