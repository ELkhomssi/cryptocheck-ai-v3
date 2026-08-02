/**
 * Shared Helius/RPC capture of wallet signatures → CapturedTrade seeds.
 * Same path as GET /api/terminal-os/trade-history — no sample invention.
 */

import 'server-only'

import { rpcCall } from '@/lib/helius-server'
import { normalizeCapturedTrade } from '@/features/terminal-os/ai-trade-like-me/lib/normalize-trade'
import type { CapturedTrade } from '@/features/terminal-os/ai-trade-like-me/types'
import { isValidSolanaMint } from '@/lib/validation/mint'

type SigRow = {
  signature: string
  blockTime?: number | null
  err?: unknown
}

export async function fetchCapturedTrades(wallet: string): Promise<CapturedTrade[]> {
  const w = wallet.trim()
  if (!isValidSolanaMint(w)) {
    return []
  }

  const sigs = await rpcCall<SigRow[]>('getSignaturesForAddress', [w, { limit: 40 }])
  const trades: CapturedTrade[] = []

  for (const s of sigs.slice(0, 24)) {
    if (s.err) continue
    const entryAt = s.blockTime
      ? new Date(s.blockTime * 1000).toISOString()
      : new Date().toISOString()
    trades.push(
      normalizeCapturedTrade({
        id: `onchain:${s.signature}`,
        wallet: w,
        tokenSymbol: 'UNK',
        tokenMint: 'So11111111111111111111111111111111111111112',
        chain: 'solana',
        side: 'buy',
        entryAt,
        entryPriceUsd: 0,
        positionSizeUsd: 0,
        entryWhy: 'On-chain signature captured for behavioral learning (read-only)',
        sample: false,
      }),
    )
  }

  return trades
}
