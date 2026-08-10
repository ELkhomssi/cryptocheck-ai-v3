/**
 * GET  /api/terminal-os/captured-trades?wallet= — real fill counts for workflow strip
 * POST /api/terminal-os/captured-trades — persist a real fill / rejected opportunity
 * Rebuilds DNA when enough closed fills exist — never from stubs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildTraderDna } from '@/features/terminal-os/ai-trade-like-me/engines/trader-dna-engine'
import { normalizeCapturedTrade } from '@/features/terminal-os/ai-trade-like-me/lib/normalize-trade'
import type { CapturedTrade } from '@/features/terminal-os/ai-trade-like-me/types'
import { captureWalletTradesForDna, MIN_CLOSED_FOR_DNA } from '@/lib/terminal-os/capture-wallet-trades'
import { savePersistedDna } from '@/lib/terminal-os/dna-store'
import { redis } from '@/lib/cache/redis'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TRADE_KEY = (wallet: string) => `ccai:tos:captured:${wallet}`

async function loadMergedTrades(wallet: string): Promise<CapturedTrade[]> {
  const capture = await captureWalletTradesForDna(wallet)
  const liveRaw = await redis.get(TRADE_KEY(wallet))
  let live: CapturedTrade[] = []
  if (liveRaw) {
    try {
      live = JSON.parse(liveRaw) as CapturedTrade[]
    } catch {
      live = []
    }
  }
  const byId = new Map<string, CapturedTrade>()
  for (const t of [...live, ...capture.trades]) {
    if (t.sample) continue
    byId.set(t.id, t)
  }
  return Array.from(byId.values())
}

/** Real executed fills only — excludes rejects and sample rows. */
function countExecutedFills(trades: CapturedTrade[]): number {
  return trades.filter(
    (t) =>
      !t.sample &&
      !t.wasRejectedOpportunity &&
      (t.side === 'buy' || t.side === 'sell') &&
      (t.positionSizeUsd > 0 || t.entryPriceUsd > 0),
  ).length
}

/**
 * GET — honest executed-fill count for Autonomous Workflow strip.
 * Never invents session stats; returns 0 when the wallet has no real fills.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet || !isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Valid Solana wallet required' }, { status: 400 })
  }

  try {
    const all = await loadMergedTrades(wallet)
    const executedFills = countExecutedFills(all)
    const rejected = all.filter((t) => t.wasRejectedOpportunity).length
    return NextResponse.json(
      {
        wallet,
        count: all.length,
        executedFills,
        rejected,
        decisionsPublished: undefined,
        trades: all.slice(0, 40).map((t) => ({
          id: t.id,
          side: t.side,
          tokenSymbol: t.tokenSymbol,
          entryAt: t.entryAt,
          positionSizeUsd: t.positionSizeUsd,
          wasRejectedOpportunity: t.wasRejectedOpportunity,
          sample: t.sample ?? false,
        })),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Captured trades unavailable',
        executedFills: 0,
        count: 0,
        trades: [],
      },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    )
  }
}

async function appendCaptured(wallet: string, trade: CapturedTrade): Promise<number> {
  const key = TRADE_KEY(wallet)
  const raw = await redis.get(key)
  let list: CapturedTrade[] = []
  if (raw) {
    try {
      list = JSON.parse(raw) as CapturedTrade[]
    } catch {
      list = []
    }
  }
  list = [trade, ...list.filter((t) => t.id !== trade.id)].slice(0, 200)
  await redis.setex(key, 60 * 60 * 24 * 90, JSON.stringify(list))
  return list.length
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  if (!wallet || !isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Valid Solana wallet required' }, { status: 400 })
  }

  const side = body.side === 'sell' || body.side === 'reject' ? body.side : 'buy'
  const tokenMint = typeof body.tokenMint === 'string' ? body.tokenMint.trim() : ''
  if (!tokenMint || tokenMint.length < 32) {
    return NextResponse.json({ error: 'tokenMint required' }, { status: 400 })
  }

  const entryPriceUsd = Number(body.entryPriceUsd)
  const positionSizeUsd = Number(body.positionSizeUsd)
  const rejected = side === 'reject' || Boolean(body.wasRejectedOpportunity)

  if (!rejected && (!(entryPriceUsd > 0) || !(positionSizeUsd > 0))) {
    return NextResponse.json(
      { error: 'entryPriceUsd and positionSizeUsd required for fills' },
      { status: 400 },
    )
  }

  const trade = normalizeCapturedTrade({
    id:
      typeof body.id === 'string' && body.id
        ? body.id
        : `live:${wallet.slice(0, 8)}:${tokenMint.slice(0, 8)}:${Date.now()}`,
    wallet,
    tokenSymbol:
      typeof body.tokenSymbol === 'string' && body.tokenSymbol
        ? body.tokenSymbol
        : tokenMint.slice(0, 4),
    tokenMint,
    chain: 'solana',
    side: rejected ? 'reject' : side,
    entryAt:
      typeof body.entryAt === 'string' ? body.entryAt : new Date().toISOString(),
    exitAt: typeof body.exitAt === 'string' ? body.exitAt : null,
    entryPriceUsd: rejected ? 0 : entryPriceUsd,
    exitPriceUsd: body.exitPriceUsd != null ? Number(body.exitPriceUsd) : null,
    pnlPct: body.pnlPct != null ? Number(body.pnlPct) : null,
    holdingDurationMs:
      body.holdingDurationMs != null ? Number(body.holdingDurationMs) : null,
    positionSizeUsd: rejected ? 0 : positionSizeUsd,
    wasRejectedOpportunity: rejected,
    rejectionReasonInferred:
      typeof body.rejectionReasonInferred === 'string'
        ? body.rejectionReasonInferred
        : rejected
          ? 'Scanned / Decision shown — user did not execute'
          : undefined,
    entryWhy:
      typeof body.entryWhy === 'string'
        ? body.entryWhy
        : rejected
          ? 'Rejected opportunity after Decision review'
          : 'Live swap via Intelligence Swap / Secure Execution',
    sample: false,
  })

  const stored = await appendCaptured(wallet, trade)

  // Rebuild DNA from Helius backfill + live captures when enough closed fills
  const capture = await captureWalletTradesForDna(wallet)
  const liveRaw = await redis.get(TRADE_KEY(wallet))
  let live: CapturedTrade[] = []
  if (liveRaw) {
    try {
      live = JSON.parse(liveRaw) as CapturedTrade[]
    } catch {
      live = []
    }
  }
  const merged = [...live, ...capture.trades]
  const byId = new Map(merged.map((t) => [t.id, t]))
  const all = Array.from(byId.values())
  // Gate DNA on real closed PnL fills only — rejects inform risk profile but
  // must not inflate sampleSize / winRate without priced round-trips.
  const closedPnl = all.filter((t) => t.pnlPct != null && !t.wasRejectedOpportunity)
  let dnaSaved = false
  if (closedPnl.length >= MIN_CLOSED_FOR_DNA) {
    const dna = buildTraderDna(wallet, all)
    if ((dna.avgHoldingMs ?? 0) > 0 && dna.sampleSize >= MIN_CLOSED_FOR_DNA) {
      await savePersistedDna(dna)
      dnaSaved = true
    }
  }

  // Ensure wallet is on rotation watchlist for unattended ticks
  try {
    const key = 'ccai:tos:rotation:watchlist'
    const raw = await redis.get(key)
    let wallets: string[] = raw ? (JSON.parse(raw) as string[]) : []
    if (!Array.isArray(wallets)) wallets = []
    wallets = [wallet, ...wallets.filter((w) => w !== wallet)].slice(0, 48)
    await redis.setex(key, 60 * 60 * 24 * 30, JSON.stringify(wallets))
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    ok: true,
    stored,
    dnaSaved,
    closedFills: all.filter((t) => t.pnlPct != null).length,
    rejected: all.filter((t) => t.wasRejectedOpportunity).length,
  })
}
