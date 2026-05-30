'use client'

import { ageLabel, fmtCompact, shortMint } from '../terminal-utils'
import type { TokenCard } from '../terminal-types'
import { TokenAvatar } from './TokenAvatar'

export function TrendingView({
  cards,
  onOpen,
  onQuickBuy,
}: {
  cards: TokenCard[]
  onOpen: (mint: string) => void
  onQuickBuy: (mint: string) => void
}) {
  return (
    <div className="web4-panel overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-xs uppercase tracking-wide text-[#666]">
              <th className="px-4 py-3 font-medium">Pair</th>
              <th className="px-4 py-3 font-medium">Market Cap</th>
              <th className="px-4 py-3 font-medium">Liquidity</th>
              <th className="px-4 py-3 font-medium">Volume</th>
              <th className="px-4 py-3 font-medium">Txns</th>
              <th className="px-4 py-3 font-medium">Curve</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {cards.map((coin) => (
              <tr
                key={coin.id}
                className="border-b border-[#2a2a2a] transition hover:bg-[#1a1a1a]"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(coin.mint)}
                    className="flex items-center gap-3 text-left"
                  >
                    <TokenAvatar coin={coin} />
                    <div>
                      <p className="font-semibold text-white">
                        {coin.name}{' '}
                        <span className="text-[#86efac]">${coin.ticker}</span>
                      </p>
                      <p className="font-mono text-[0.65rem] text-white/40">
                        {ageLabel(coin.createdAt)} · {shortMint(coin.mint)}
                      </p>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono font-bold text-white">{fmtCompact(coin.marketCap)}</p>
                  <p
                    className={`font-mono text-xs ${coin.change24h >= 0 ? 'text-[#22c55e]' : 'text-red-400'}`}
                  >
                    {coin.change24h >= 0 ? '+' : ''}
                    {coin.change24h.toFixed(1)}%
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-white/80">{fmtCompact(coin.liquidityUsd)}</td>
                <td className="px-4 py-3 font-mono text-white/80">
                  {fmtCompact(coin.volumeSol * 168)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-white/80">
                    {(coin.buys + coin.sells).toLocaleString()}
                  </p>
                  <p className="text-xs">
                    <span className="text-[#22c55e]">{coin.buys.toLocaleString()}</span>
                    <span className="text-white/30"> / </span>
                    <span className="text-red-400">{coin.sells.toLocaleString()}</span>
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="w-20">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[#22c55e]"
                        style={{ width: `${coin.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[0.6rem] text-white/40">
                      {coin.graduated ? 'Migrated' : `${coin.progress.toFixed(0)}%`}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onQuickBuy(coin.mint)}
                    className="web4-btn-buy px-3 py-1.5 text-xs"
                  >
                    0.1 SOL
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
