'use client'

import { ArrowLeft, Copy } from 'lucide-react'
import { PUMP_GRADUATION_SOL, PUMP_TOTAL_SUPPLY } from '../pump-curve'
import { fmt, fmtCompact, shortMint } from '../terminal-utils'
import type { Candle, Side, Timeframe, TokenCard, TradeRow } from '../terminal-types'
import { CandlestickChart } from './CandlestickChart'
import { Panel } from './terminal-primitives'
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
  txLabel,
  txBusy,
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
  txLabel?: string
  txBusy?: boolean
}) {
  const buys = tradeRows.filter((r) => r.side === 'buy').length
  const sells = tradeRows.filter((r) => r.side === 'sell').length

  return (
    <div className="flex flex-col gap-4">
      {graduated ? (
        <div className="rounded-lg border border-[#86efac]/40 bg-[#1a1a1a] px-4 py-3 text-center text-sm text-[#86efac]">
          Graduated — {PUMP_GRADUATION_SOL} SOL raised · trading on Raydium
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-b border-[#2a2a2a] pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg border border-[#2a2a2a] px-2 py-1 text-xs text-[#888] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <TokenAvatar coin={coin} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-white">
            {coin.ticker}/SOL
            <span className="ml-2 text-sm font-normal text-[#888]">{coin.name}</span>
          </h1>
          <button
            type="button"
            className="flex items-center gap-1 font-mono text-xs text-[#666] hover:text-[#888]"
            onClick={() => void navigator.clipboard.writeText(coin.mint)}
          >
            {shortMint(coin.mint)}
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-[#666]">Market cap</p>
            <p className="font-medium tabular-nums text-white">{fmtCompact(coin.marketCap)}</p>
          </div>
          <div>
            <p className="text-xs text-[#666]">Price</p>
            <p className="font-medium tabular-nums text-white">${fmt(priceUsd, 6)}</p>
          </div>
          <div>
            <p className="text-xs text-[#666]">24h</p>
            <p
              className={`font-medium tabular-nums ${
                change24h >= 0 ? 'text-[#86efac]' : 'text-[#f87171]'
              }`}
            >
              {change24h >= 0 ? '+' : ''}
              {change24h.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <Panel className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#2a2a2a] px-3 py-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onTimeframe(tf)}
                  className={`rounded px-2 py-0.5 font-mono text-xs ${
                    timeframe === tf ? 'bg-[#2a2a2a] text-white' : 'text-[#666] hover:text-[#ccc]'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <span className="ml-auto font-mono text-xs text-[#666]">{fmt(priceSol, 8)} SOL</span>
            </div>
            <div className="h-[280px] md:h-[340px]">
              <CandlestickChart candles={candles} height={340} />
            </div>
            <div className="border-t border-[#2a2a2a] px-3 py-2">
              <div className="mb-1 flex justify-between text-xs text-[#666]">
                <span>Bonding curve</span>
                <span>
                  {curvePct.toFixed(1)}% · {PUMP_GRADUATION_SOL} SOL
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#2a2a2a]">
                <div
                  className="h-full bg-[#86efac]"
                  style={{ width: `${Math.min(100, curvePct)}%` }}
                />
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden p-0">
            <div className="flex gap-4 border-b border-[#2a2a2a] px-4 py-2 text-xs text-[#666]">
              <span className="font-medium text-white">Trades</span>
              <span>Vol {fmtCompact(coin.volumeSol * solUsd)}</span>
              <span className="text-[#86efac]">Buys {buys}</span>
              <span className="text-[#f87171]">Sells {sells}</span>
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#1a1a1a] text-[#666]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">SOL</th>
                    <th className="px-3 py-2 font-medium">Maker</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[#2a2a2a] font-mono transition-colors"
                      style={{
                        backgroundColor:
                          flashTradeId === row.id
                            ? row.side === 'buy'
                              ? 'rgba(134,239,172,0.08)'
                              : 'rgba(248,113,113,0.08)'
                            : undefined,
                      }}
                    >
                      <td className="px-3 py-1.5 text-[#888]">{row.time}</td>
                      <td
                        className={`px-3 py-1.5 font-medium ${
                          row.side === 'buy' ? 'text-[#86efac]' : 'text-[#f87171]'
                        }`}
                      >
                        {row.side}
                      </td>
                      <td className="px-3 py-1.5 text-[#ccc]">{fmt(row.amount, 0)}</td>
                      <td className="px-3 py-1.5 text-[#ccc]">{fmt(row.total, 4)}</td>
                      <td className="px-3 py-1.5 text-[#666]">{row.wallet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tradeRows.length === 0 ? (
                <p className="py-8 text-center text-[#666]">No trades yet</p>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel className="p-4 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-[#111] p-1">
            <button
              type="button"
              onClick={() => onTradeSide('buy')}
              className={`rounded-md py-2 text-sm font-semibold ${
                tradeSide === 'buy' ? 'web4-btn-buy' : 'text-[#666]'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => onTradeSide('sell')}
              className={`rounded-md py-2 text-sm font-semibold ${
                tradeSide === 'sell' ? 'bg-[#f87171] text-white' : 'text-[#666]'
              }`}
            >
              Sell
            </button>
          </div>

          <p className="mb-1 text-xs text-[#666]">Amount (SOL)</p>
          <input
            type="number"
            min={0}
            step={0.01}
            value={tradeAmount}
            onChange={(e) => onTradeAmount(Number(e.target.value))}
            className="web4-input mb-2 w-full px-3 py-2.5 font-mono text-sm"
          />
          <div className="mb-3 flex gap-1">
            {[0.1, 0.25, 0.5, 1].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onTradeAmount(v)}
                className="flex-1 rounded border border-[#2a2a2a] py-1 font-mono text-xs text-[#888] hover:border-[#444] hover:text-white"
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onTradeAmount(Math.max(0, maxSol * 0.98))}
              className="rounded border border-[#444] px-2 py-1 font-mono text-xs font-medium text-[#86efac]"
            >
              MAX
            </button>
          </div>

          <p className="mb-4 text-xs text-[#666]">
            You receive{' '}
            <span className="font-mono text-[#86efac]">
              {fmt(estimatedOutput, outputUnit === 'SOL' ? 4 : 0)} {outputUnit}
            </span>
          </p>

          {txLabel ? (
            <p className="mb-2 text-center text-xs text-[#86efac]" role="status">
              {txLabel}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onExecute}
            disabled={disabled || txBusy}
            className={`w-full py-3 text-sm font-semibold disabled:opacity-50 ${
              tradeSide === 'buy' ? 'web4-btn-buy' : 'rounded-lg bg-[#f87171] text-white hover:opacity-90'
            }`}
          >
            {txBusy
              ? 'Confirm in wallet…'
              : tradeSide === 'buy'
                ? `Buy ${coin.ticker}`
                : `Sell ${coin.ticker}`}
          </button>

          <div className="mt-4 space-y-2 border-t border-[#2a2a2a] pt-4 text-xs">
            <div className="flex justify-between">
              <span className="text-[#666]">SOL balance</span>
              <span className="tabular-nums text-white">{fmt(solBalance, 4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">{coin.ticker} held</span>
              <span className="tabular-nums text-[#86efac]">{fmt(heldTokens, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">Supply</span>
              <span className="tabular-nums text-[#888]">{(PUMP_TOTAL_SUPPLY / 1e6).toFixed(0)}M</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
