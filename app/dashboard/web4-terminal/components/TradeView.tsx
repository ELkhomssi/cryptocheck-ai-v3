'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Copy } from 'lucide-react'
import { PUMP_GRADUATION_SOL, PUMP_TOTAL_SUPPLY } from '../pump-curve'
import { fmt, fmtCompact, shortMint } from '../terminal-utils'
import type { Candle, Side, Timeframe, TokenCard, TradeRow } from '../terminal-types'
import { CandlestickChart } from './CandlestickChart'
import { GlassCard } from './terminal-primitives'
import { TokenAvatar } from './TokenAvatar'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']

export function TradeView({
  coin,
  candles,
  tradeRows,
  flashTradeId,
  timeframe,
  onTimeframe,
  tradeSide,
  onTradeSide,
  tradeAmount,
  onTradeAmount,
  estimatedOutput,
  outputUnit,
  onExecute,
  maxSol,
  disabled,
  graduated,
  curvePct,
  solBalance,
  heldTokens,
  priceSol,
  priceUsd,
  change24h,
  solUsd,
  onBack,
}: {
  coin: TokenCard
  candles: Candle[]
  tradeRows: TradeRow[]
  flashTradeId: string | null
  timeframe: Timeframe
  onTimeframe: (t: Timeframe) => void
  tradeSide: Side
  onTradeSide: (s: Side) => void
  tradeAmount: number
  onTradeAmount: (n: number) => void
  estimatedOutput: number
  outputUnit: 'tokens' | 'SOL'
  onExecute: () => void
  maxSol: number
  disabled: boolean
  graduated: boolean
  curvePct: number
  solBalance: number
  heldTokens: number
  priceSol: number
  priceUsd: number
  change24h: number
  solUsd: number
  onBack: () => void
}) {
  const buys = tradeRows.filter((r) => r.side === 'buy').length
  const sells = tradeRows.filter((r) => r.side === 'sell').length

  return (
    <div className="flex flex-col gap-3">
      {graduated ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#22c55e]/50 bg-gradient-to-r from-[#22c55e]/15 to-transparent px-4 py-3 text-center"
        >
          <p className="text-sm font-bold text-[#86efac]">
            Graduated — migrating to Raydium ({PUMP_GRADUATION_SOL} SOL raised)
          </p>
        </motion.div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-b border-[#1f1f1f] pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg border border-[#2a2a2a] px-2 py-1 text-xs text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <TokenAvatar coin={coin} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white">
            {coin.ticker}/SOL
            <span className="ml-2 text-sm font-normal text-white/50">{coin.name}</span>
          </h1>
          <button
            type="button"
            className="flex items-center gap-1 font-mono text-[0.65rem] text-white/40 hover:text-white/70"
            onClick={() => void navigator.clipboard.writeText(coin.mint)}
          >
            {shortMint(coin.mint)} · pump
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-[0.65rem] text-white/40">Market Cap</p>
            <p className="font-mono text-xl font-bold text-white">{fmtCompact(coin.marketCap)}</p>
          </div>
          <div>
            <p className="text-[0.65rem] text-white/40">Price</p>
            <p className="font-mono font-bold text-white">${fmt(priceUsd, 6)}</p>
          </div>
          <div>
            <p className="text-[0.65rem] text-white/40">24h</p>
            <p className={`font-mono font-bold ${change24h >= 0 ? 'text-[#22c55e]' : 'text-red-400'}`}>
              {change24h >= 0 ? '+' : ''}
              {change24h.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-3">
          <GlassCard className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#1f1f1f] px-3 py-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onTimeframe(tf)}
                  className={`rounded px-2 py-0.5 font-mono text-xs ${
                    timeframe === tf ? 'bg-[#22c55e]/20 text-[#86efac]' : 'text-white/40'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <span className="ml-auto font-mono text-[0.65rem] text-white/30">
                {fmt(priceSol, 8)} SOL
              </span>
            </div>
            <div className="h-[280px] md:h-[340px]">
              <CandlestickChart candles={candles} height={340} />
            </div>
            <div className="border-t border-[#1f1f1f] px-3 py-2">
              <div className="mb-1 flex justify-between text-[0.65rem] text-white/40">
                <span>Bonding curve</span>
                <span>
                  {curvePct.toFixed(1)}% · {PUMP_GRADUATION_SOL} SOL cap
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-[#22c55e] to-[#86efac]"
                  style={{ width: `${Math.min(100, curvePct)}%` }}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            <div className="flex gap-4 border-b border-[#1f1f1f] px-4 py-2 text-xs font-semibold text-white/50">
              <span className="text-white">Trades</span>
              <span>Volume {fmtCompact(coin.volumeSol * solUsd)}</span>
              <span className="text-[#22c55e]">Buys {buys}</span>
              <span className="text-red-400">Sells {sells}</span>
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0d0d0d] text-white/40">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2">MCap</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">SOL</th>
                    <th className="px-3 py-2">Maker</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeRows.map((row) => (
                    <motion.tr
                      key={row.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        backgroundColor:
                          flashTradeId === row.id
                            ? row.side === 'buy'
                              ? 'rgba(34,197,94,0.15)'
                              : 'rgba(239,68,68,0.12)'
                            : 'transparent',
                      }}
                      className="border-t border-[#1a1a1a] font-mono"
                    >
                      <td className="px-3 py-1.5 text-white/50">{row.time}</td>
                      <td
                        className={`px-3 py-1.5 font-semibold ${
                          row.side === 'buy' ? 'text-[#22c55e]' : 'text-red-400'
                        }`}
                      >
                        {row.side}
                      </td>
                      <td className="px-3 py-1.5 text-white/70">{fmtCompact(coin.marketCap)}</td>
                      <td className="px-3 py-1.5">{fmt(row.amount, 0)}</td>
                      <td className="px-3 py-1.5">{fmt(row.total, 4)}</td>
                      <td className="px-3 py-1.5 text-white/50">{row.wallet}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {tradeRows.length === 0 ? (
                <p className="py-8 text-center text-white/30">Waiting for trades…</p>
              ) : null}
            </div>
          </GlassCard>
        </div>

        <GlassCard className="p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-[#0a0a0a] p-1">
            <button
              type="button"
              onClick={() => onTradeSide('buy')}
              className={`rounded-md py-2 text-sm font-bold ${
                tradeSide === 'buy' ? 'bg-[#22c55e] text-black' : 'text-white/50'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => onTradeSide('sell')}
              className={`rounded-md py-2 text-sm font-bold ${
                tradeSide === 'sell' ? 'bg-red-500 text-white' : 'text-white/50'
              }`}
            >
              Sell
            </button>
          </div>

          <p className="mb-1 text-xs text-white/40">Amount (SOL)</p>
          <input
            type="number"
            min={0}
            step={0.01}
            value={tradeAmount}
            onChange={(e) => onTradeAmount(Number(e.target.value))}
            className="mb-2 w-full rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 font-mono text-white outline-none focus:border-[#22c55e]/50"
          />
          <div className="mb-3 flex gap-1">
            {[0.1, 0.25, 0.5, 1].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onTradeAmount(v)}
                className="flex-1 rounded border border-[#2a2a2a] py-1 font-mono text-xs text-white/70 hover:border-[#22c55e]/40"
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onTradeAmount(Math.max(0, maxSol * 0.98))}
              className="rounded border border-[#22c55e]/40 px-2 py-1 font-mono text-xs font-bold text-[#86efac]"
            >
              MAX
            </button>
          </div>

          <p className="mb-4 text-xs text-white/50">
            Est. output:{' '}
            <span className="font-mono text-[#86efac]">
              {fmt(estimatedOutput, outputUnit === 'SOL' ? 4 : 0)} {outputUnit}
            </span>
          </p>

          <button
            type="button"
            onClick={onExecute}
            disabled={disabled}
            className={`w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-50 ${
              tradeSide === 'buy'
                ? 'web4-btn-primary text-black'
                : 'bg-red-500 text-white shadow-[0_0_24px_rgba(239,68,68,0.25)] hover:bg-red-400'
            }`}
          >
            {tradeSide === 'buy' ? `Buy ${coin.ticker}` : `Sell ${coin.ticker}`}
          </button>

          <div className="mt-4 space-y-2 border-t border-[#1f1f1f] pt-4 text-xs">
            <div className="flex justify-between">
              <span className="text-white/40">Wallet SOL</span>
              <span className="font-mono text-white">{fmt(solBalance, 4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">{coin.ticker} held</span>
              <span className="font-mono text-[#86efac]">{fmt(heldTokens, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Supply</span>
              <span className="font-mono text-white/70">{(PUMP_TOTAL_SUPPLY / 1e6).toFixed(0)}M</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
