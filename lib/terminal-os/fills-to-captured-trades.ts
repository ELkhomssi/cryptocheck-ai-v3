/**
 * Pure FIFO fills → CapturedTrade (safe for unit tests — no server-only).
 */

import { normalizeCapturedTrade } from '@/features/terminal-os/ai-trade-like-me/lib/normalize-trade'
import type { CapturedTrade } from '@/features/terminal-os/ai-trade-like-me/types'
import type { FifoFill } from '@/lib/terminal/portfolio-math'

type OpenLot = { qty: number; unitCostUsd: number; ts: number; mint: string }

/**
 * FIFO round-trips → CapturedTrade with real entry/exit/hold/PnL.
 * Open buys (no exit yet) recorded honestly without fabricated exit.
 */
export function fillsToCapturedTrades(
  wallet: string,
  fills: FifoFill[],
): {
  trades: CapturedTrade[]
  closedRounds: number
  openBuysRecorded: number
} {
  const lotsByMint = new Map<string, OpenLot[]>()
  const trades: CapturedTrade[] = []
  let closedRounds = 0
  let openBuysRecorded = 0
  const ordered = [...fills].sort((a, b) => a.ts - b.ts || a.mint.localeCompare(b.mint))

  for (const f of ordered) {
    if (!(f.qty > 0) || !(f.priceUsd > 0)) continue
    if (!lotsByMint.has(f.mint)) lotsByMint.set(f.mint, [])
    const lots = lotsByMint.get(f.mint)!

    if (f.side === 'buy') {
      lots.push({ qty: f.qty, unitCostUsd: f.priceUsd, ts: f.ts, mint: f.mint })
      continue
    }

    let qtyLeft = f.qty
    while (qtyLeft > 1e-12 && lots.length) {
      const lot = lots[0]!
      const take = Math.min(lot.qty, qtyLeft)
      const cost = lot.unitCostUsd * take
      const proceeds = f.priceUsd * take
      const pnlPct = cost > 0 ? ((proceeds - cost) / cost) * 100 : 0
      const holdMs = Math.max(0, f.ts - lot.ts)
      const positionSizeUsd = cost
      const sym = f.mint.slice(0, 4).toUpperCase()

      trades.push(
        normalizeCapturedTrade({
          id: `fill:${f.mint}:${lot.ts}:${f.ts}:${closedRounds}`,
          wallet,
          tokenSymbol: sym,
          tokenMint: f.mint,
          chain: 'solana',
          side: 'sell',
          entryAt: new Date(lot.ts).toISOString(),
          exitAt: new Date(f.ts).toISOString(),
          entryPriceUsd: lot.unitCostUsd,
          exitPriceUsd: f.priceUsd,
          pnlPct,
          holdingDurationMs: holdMs,
          positionSizeUsd,
          entryWhy: 'On-chain SOL-paired swap fill (Helius enhanced tx)',
          exitWhy: 'On-chain SOL-paired sell fill (Helius enhanced tx)',
          sample: false,
        }),
      )
      closedRounds += 1

      lot.qty -= take
      qtyLeft -= take
      if (lot.qty <= 1e-12) lots.shift()
    }
  }

  for (const [, lots] of lotsByMint) {
    for (const lot of lots) {
      if (!(lot.qty > 0)) continue
      const sym = lot.mint.slice(0, 4).toUpperCase()
      trades.push(
        normalizeCapturedTrade({
          id: `open:${lot.mint}:${lot.ts}`,
          wallet,
          tokenSymbol: sym,
          tokenMint: lot.mint,
          chain: 'solana',
          side: 'buy',
          entryAt: new Date(lot.ts).toISOString(),
          entryPriceUsd: lot.unitCostUsd,
          positionSizeUsd: lot.unitCostUsd * lot.qty,
          entryWhy: 'Open position — no exit fill yet (Helius enhanced tx)',
          sample: false,
        }),
      )
      openBuysRecorded += 1
    }
  }

  return { trades, closedRounds, openBuysRecorded }
}
