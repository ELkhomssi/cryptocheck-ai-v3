import { NextRequest, NextResponse } from 'next/server'
import { rpcCall } from '@/lib/helius-server'
import { normalizeCapturedTrade } from '@/features/terminal-os/ai-trade-like-me/lib/normalize-trade'
import type { CapturedTrade } from '@/features/terminal-os/ai-trade-like-me/types'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SigRow = {
  signature: string
  blockTime?: number | null
  err?: unknown
}

/**
 * GET /api/terminal-os/trade-history?wallet=
 * Captures recent on-chain signatures as CapturedTrade seeds (read-only).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Valid Solana wallet required' }, { status: 400 })
  }

  try {
    const sigs = await rpcCall<SigRow[]>('getSignaturesForAddress', [wallet, { limit: 40 }])
    const trades: CapturedTrade[] = []

    for (const s of sigs.slice(0, 24)) {
      if (s.err) continue
      const entryAt = s.blockTime
        ? new Date(s.blockTime * 1000).toISOString()
        : new Date().toISOString()
      trades.push(
        normalizeCapturedTrade({
          id: `onchain:${s.signature}`,
          wallet,
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

    return NextResponse.json(
      { trades, count: trades.length, source: 'rpc_signatures' },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Trade history fetch failed',
        trades: [] as CapturedTrade[],
      },
      { status: 502 },
    )
  }
}
