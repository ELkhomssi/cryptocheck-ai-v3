import 'server-only'

import { listFeeRecords } from '@/lib/revenue-dashboard/fee-store'
import type { TopTraderRow, TopTradersResult } from './top-traders-types'

export type { TopTraderRow, TopTradersResult } from './top-traders-types'

const MIN_WALLETS = 3
const MIN_SWAPS = 5

/**
 * Rank wallets by real swap volume through the risk-gated engine.
 * PnL % is NOT fabricated — show SOON until enough measured activity exists.
 */
export async function buildTopTraders(): Promise<TopTradersResult> {
  const records = await listFeeRecords(500)
  if (records.length < MIN_SWAPS) {
    return {
      status: 'soon',
      reason: 'Leaderboard unlocks with live trading volume through CryptoCheck swaps.',
    }
  }

  const byWallet = new Map<string, { volumeUsd: number; swaps: number[] }>()
  for (const r of records) {
    const w = r.walletAddress?.trim()
    if (!w) continue
    const cur = byWallet.get(w) ?? { volumeUsd: 0, swaps: [] }
    cur.volumeUsd += r.volumeUsd ?? 0
    cur.swaps.push(r.volumeUsd ?? 0)
    byWallet.set(w, cur)
  }

  if (byWallet.size < MIN_WALLETS) {
    return {
      status: 'soon',
      reason: 'Leaderboard unlocks with live trading volume through CryptoCheck swaps.',
    }
  }

  const traders = [...byWallet.entries()]
    .sort((a, b) => b[1].volumeUsd - a[1].volumeUsd)
    .slice(0, 5)
    .map(([wallet, data], i) => ({
      rank: i + 1,
      walletAddress: wallet,
      volumeUsd: Math.round(data.volumeUsd * 100) / 100,
      swapCount: data.swaps.length,
      sparkline: data.swaps.slice(-8).reverse(),
    }))

  return {
    status: 'live',
    traders,
    label: 'Ranked by platform swap volume — not estimated PnL',
  }
}
