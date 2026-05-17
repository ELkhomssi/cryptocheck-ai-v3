'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Compass,
  Flame,
  Home,
  Plus,
  Search,
  Terminal,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { fmt, fmtCompact } from './terminal-utils'
import { usePumpTerminal } from './use-pump-terminal'
import { CreateTokenModal } from './components/CreateTokenModal'
import { DiscoverView } from './components/DiscoverView'
import { TrendingView } from './components/TrendingView'
import { TrenchesView } from './components/TrenchesView'
import { TradeView } from './components/TradeView'
import {
  LivePulse,
  LoadingTerminal,
  MarqueeTicker,
  TerminalMesh,
  ToastStack,
} from './components/terminal-primitives'
import type { TerminalView } from './terminal-types'

const NAV: { id: TerminalView | 'create'; label: string; icon: typeof Home }[] = [
  { id: 'discover', label: 'Home', icon: Home },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'trade', label: 'Terminal', icon: Terminal },
  { id: 'trenches', label: 'Trenches', icon: Flame },
  { id: 'create', label: 'Create', icon: Plus },
]

export function Web4PumpDashboard() {
  const t = usePumpTerminal()

  if (!t.ready) return <LoadingTerminal />

  const handleNav = (id: TerminalView | 'create') => {
    if (id === 'create') {
      t.setCreateOpen(true)
      return
    }
    t.navigate(id)
  }

  const tickerItems = t.cards.slice(0, 12).map((coin) => ({
    key: coin.id,
    node: (
      <button
        type="button"
        onClick={() => t.openTrade(coin.mint)}
        className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs transition hover:border-[#22c55e]/30 hover:bg-[#22c55e]/5"
      >
        <span className="text-base">{coin.emoji}</span>
        <span className="font-bold text-white">{coin.ticker}</span>
        <span className="font-mono text-white/60">{fmtCompact(coin.marketCap)}</span>
        <span className={coin.change24h >= 0 ? 'font-mono text-[#4ade80]' : 'font-mono text-red-400'}>
          {coin.change24h >= 0 ? '+' : ''}
          {coin.change24h.toFixed(0)}%
        </span>
      </button>
    ),
  }))

  return (
    <motion.div
      className="relative flex min-h-[calc(100vh-2.5rem)] w-full flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <TerminalMesh />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#86efac] to-[#22c55e] text-sm font-black text-black">
              W4
            </div>
            <div>
              <span className="block text-sm font-bold leading-none text-white">
                Web4<span className="text-[#86efac]">.fun</span>
              </span>
              <LivePulse label="ENGINE" />
            </div>
          </motion.div>

          <div className="relative min-w-[180px] flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
            <input
              value={t.search}
              onChange={(e) => t.setSearch(e.target.value)}
              placeholder="Search · paste CA"
              className="w-full rounded-full border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-16 text-sm text-white outline-none transition focus:border-[#22c55e]/40 focus:shadow-[0_0_24px_rgba(34,197,94,0.12)]"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.6rem] text-white/30 sm:inline">
              /
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="web4-glass hidden rounded-xl px-4 py-2 text-right sm:block">
              <p className="text-[0.55rem] uppercase tracking-wider text-white/35">Portfolio</p>
              <p className="font-mono text-sm font-bold text-[#86efac]">{fmt(t.solBalance, 2)} SOL</p>
              <p className="font-mono text-[0.65rem] text-white/45">{fmtCompact(t.portfolioUsd)}</p>
            </div>
            {t.isConnected ? (
              <button
                type="button"
                onClick={t.disconnect}
                className="web4-glass flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80"
              >
                <Wallet className="h-4 w-4 text-[#86efac]" />
                {t.shortAddr}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void t.connect()}
                disabled={t.isConnecting}
                className="web4-btn-primary rounded-xl px-5 py-2.5 text-xs font-bold text-black disabled:opacity-50"
              >
                {t.isConnecting ? 'Connecting…' : 'Connect'}
              </button>
            )}
          </div>
        </div>
        <MarqueeTicker items={tickerItems} />
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          className="hidden w-[76px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.06] py-4 md:flex"
          aria-label="Web4 navigation"
        >
          {NAV.map((item) => {
            const Icon = item.icon
            const active = item.id !== 'create' && t.view === item.id
            const isCreate = item.id === 'create'
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative flex w-[60px] flex-col items-center gap-1 rounded-xl py-2.5 text-[0.58rem] font-semibold transition ${
                  isCreate
                    ? 'mt-2 bg-gradient-to-b from-[#86efac] to-[#4ade80] text-black shadow-[0_0_24px_rgba(34,197,94,0.35)]'
                    : active
                      ? 'bg-white/[0.08] text-[#86efac]'
                      : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
                }`}
              >
                {active && !isCreate ? (
                  <span className="absolute -left-px top-2 bottom-2 w-0.5 rounded-full bg-[#4ade80]" />
                ) : null}
                <Icon className="h-5 w-5" strokeWidth={isCreate ? 2.5 : 2} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-2 py-2 md:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  item.id === 'create'
                    ? 'bg-[#86efac] text-black'
                    : t.view === item.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/45'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={t.view + (t.activeMint ?? '')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {t.view === 'discover' && (
                  <DiscoverView
                    cards={t.filteredCards}
                    filter={t.filter}
                    onFilter={t.setFilter}
                    onOpen={t.openTrade}
                    onQuickBuy={t.quickBuy}
                    onCreate={() => t.setCreateOpen(true)}
                  />
                )}
                {t.view === 'trending' && (
                  <TrendingView cards={t.filteredCards} onOpen={t.openTrade} onQuickBuy={t.quickBuy} />
                )}
                {t.view === 'trenches' && (
                  <TrenchesView trenches={t.trenches} onOpen={t.openTrade} onQuickBuy={t.quickBuy} />
                )}
                {t.view === 'trade' && t.activeCard && (
                  <TradeView
                    coin={t.activeCard}
                    candles={t.candles}
                    tradeRows={t.tradeRows}
                    flashTradeId={t.flashTradeId}
                    timeframe={t.timeframe}
                    onTimeframe={t.setTimeframe}
                    tradeSide={t.tradeSide}
                    onTradeSide={t.setTradeSide}
                    tradeAmount={t.tradeAmount}
                    onTradeAmount={t.setTradeAmount}
                    estimatedOutput={t.estimatedOutput}
                    outputUnit={t.outputUnit}
                    onExecute={t.handleExecute}
                    maxSol={t.tradeSide === 'buy' ? t.solBalance : t.maxSellSol}
                    disabled={!t.activeToken || t.graduated}
                    graduated={t.graduated}
                    curvePct={t.curvePct}
                    solBalance={t.solBalance}
                    heldTokens={t.heldTokens}
                    priceSol={t.priceSolLive}
                    priceUsd={t.priceUsd}
                    change24h={t.activeCard.change24h}
                    solUsd={t.solUsd}
                    onBack={() => t.navigate('discover')}
                  />
                )}
                {t.view === 'trade' && !t.activeCard && (
                  <div className="flex flex-col items-center justify-center py-24 text-white/40">
                    <Compass className="mb-4 h-12 w-12 text-[#22c55e]/40" />
                    <p className="text-sm">Pick a coin from Home to open the terminal</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <footer className="relative z-10 flex flex-wrap items-center gap-3 border-t border-white/[0.06] bg-black/60 px-4 py-2.5 text-[0.65rem] text-white/40 backdrop-blur-md">
        <span className="flex items-center gap-1.5 text-[#4ade80]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80] animate-pulse" />
          Stable · 60 FPS
        </span>
        <span className="hidden sm:inline">Bonding curve v1</span>
        <span className="ml-auto font-mono tabular-nums">
          SOL ${fmt(t.solUsd, 2)} · {fmtCompact(t.portfolioUsd)} spendable
        </span>
      </footer>

      <ToastStack toasts={t.toasts} onDismiss={t.dismissToast} />

      <CreateTokenModal
        open={t.createOpen}
        onClose={() => t.setCreateOpen(false)}
        onDeploy={t.handleDeploy}
        deploying={t.deploying}
        liquidity={t.launchLiquidity}
        onLiquidityChange={t.setLaunchLiquidity}
      />
    </motion.div>
  )
}
