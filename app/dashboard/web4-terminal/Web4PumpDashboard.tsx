'use client'

import Link from 'next/link'
import { Flame, Home, LineChart, Plus, Search, TrendingUp, Wallet } from 'lucide-react'
import { fmt, fmtCompact } from './terminal-utils'
import { usePumpTerminal } from './use-pump-terminal'
import { CreateTokenModal } from './components/CreateTokenModal'
import { DiscoverView } from './components/DiscoverView'
import { TrendingView } from './components/TrendingView'
import { TrenchesView } from './components/TrenchesView'
import { TradeView } from './components/TradeView'
import { ProtocolBanner } from './components/ProtocolBanner'
import { TxStatusBar } from './components/TxStatusBar'
import { LoadingTerminal, MarqueeTicker, ToastStack } from './components/terminal-primitives'
import type { TerminalView } from './terminal-types'

const NAV: { id: TerminalView; label: string; icon: typeof Home }[] = [
  { id: 'discover', label: 'Home', icon: Home },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'trade', label: 'Terminal', icon: LineChart },
  { id: 'trenches', label: 'Trenches', icon: Flame },
]

export function Web4PumpDashboard() {
  const t = usePumpTerminal()

  if (!t.ready) return <LoadingTerminal />

  const tickerItems = t.cards.slice(0, 14).map((coin) => ({
    key: coin.id,
    node: (
      <button
        type="button"
        onClick={() => t.openTrade(coin.mint)}
        className="flex items-center gap-2 text-sm text-[#ccc] hover:text-white"
      >
        <span>{coin.emoji}</span>
        <span className="font-medium">{coin.ticker}</span>
        <span className="text-[#888]">{fmtCompact(coin.marketCap)}</span>
        <span className={coin.change24h >= 0 ? 'text-[#86efac]' : 'text-[#f87171]'}>
          {coin.change24h >= 0 ? '+' : ''}
          {coin.change24h.toFixed(1)}%
        </span>
      </button>
    ),
  }))

  return (
    <div className="flex min-h-[calc(100vh-2rem)] w-full bg-[#111] text-white">
      <aside className="hidden w-[200px] shrink-0 flex-col border-r border-[#2a2a2a] bg-[#111] md:flex">
        <div className="px-4 py-5">
          <Link href="/web4" className="text-xl font-bold tracking-tight text-white">
            Web4<span className="text-[#86efac]">.fun</span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Main">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = t.view === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => t.navigate(item.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  active ? 'bg-[#222] text-white' : 'text-[#888] hover:bg-[#1a1a1a] hover:text-[#ccc]'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-3">
          <button
            type="button"
            onClick={() => t.setCreateOpen(true)}
            className="web4-btn-create flex w-full items-center justify-center gap-2 py-3 text-sm"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            Create coin
          </button>
        </div>

        <div className="border-t border-[#2a2a2a] px-4 py-3 text-[0.7rem] text-[#666]">
          <Link href="/dashboard" className="hover:text-[#888]">
            Developer tools →
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ProtocolBanner />
        <header className="sticky top-0 z-30 border-b border-[#2a2a2a] bg-[#111]">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg font-bold md:hidden">Web4.fun</span>
            <div className="relative mx-auto hidden w-full max-w-xl flex-1 md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
              <input
                value={t.search}
                onChange={(e) => t.setSearch(e.target.value)}
                placeholder="Search for token"
                className="web4-input w-full py-2.5 pl-10 pr-4 text-sm"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-xs text-[#888]">Balance</p>
                <p className="text-sm font-medium tabular-nums">
                  {fmt(t.solBalance, 2)} SOL
                  <span className="ml-1 text-[#666]">({fmtCompact(t.portfolioUsd)})</span>
                </p>
              </div>
              {t.isConnected ? (
                <button
                  type="button"
                  onClick={t.disconnect}
                  className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#ccc]"
                >
                  <Wallet className="h-4 w-4" />
                  {t.shortAddr}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void t.connect()}
                  disabled={t.isConnecting}
                  className="web4-btn-create px-4 py-2 text-sm disabled:opacity-50"
                >
                  {t.isConnecting ? '…' : 'Log in'}
                </button>
              )}
              <button
                type="button"
                onClick={() => t.setCreateOpen(true)}
                className="web4-btn-create hidden px-4 py-2 text-sm md:inline-flex"
              >
                Create coin
              </button>
            </div>
          </div>
          <div className="px-4 pb-3 md:hidden">
            <input
              value={t.search}
              onChange={(e) => t.setSearch(e.target.value)}
              placeholder="Search for token"
              className="web4-input w-full px-3 py-2.5 text-sm"
            />
          </div>
          <MarqueeTicker items={tickerItems} />
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-[#2a2a2a] px-2 py-2 md:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => t.navigate(item.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                t.view === item.id ? 'bg-[#222] text-white' : 'text-[#888]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => t.setCreateOpen(true)}
            className="shrink-0 rounded-lg bg-[#86efac] px-3 py-1.5 text-xs font-semibold text-black"
          >
            Create
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {t.view === 'discover' && (
            <DiscoverView
              cards={t.filteredCards}
              filter={t.filter}
              onFilter={t.setFilter}
              onOpen={t.openTrade}
              onQuickBuy={t.quickBuy}
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
              txLabel={t.txLabel}
              txBusy={t.txBusy}
            />
          )}
          {t.view === 'trade' && !t.activeCard && (
            <p className="py-20 text-center text-sm text-[#666]">Select a token to trade</p>
          )}
        </main>
      </div>

      <TxStatusBar lifecycle={t.txLifecycle} />
      <ToastStack toasts={t.toasts} onDismiss={t.dismissToast} />

      <CreateTokenModal
        open={t.createOpen}
        onClose={() => t.setCreateOpen(false)}
        onDeploy={t.handleDeploy}
        deploying={t.deploying}
        liquidity={t.launchLiquidity}
        onLiquidityChange={t.setLaunchLiquidity}
      />
    </div>
  )
}
