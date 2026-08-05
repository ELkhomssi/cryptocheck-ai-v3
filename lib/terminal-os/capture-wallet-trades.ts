/**
 * Capture real wallet fills for Trade Like Me DNA training.
 * Reuses Helius enhanced-tx + SOL-paired pricing pattern from
 * lib/terminal/portfolio-analytics.ts (keep in sync).
 *
 * Never invents fills. Signature-only stubs are not returned.
 */

import 'server-only'

import { buildHeliusApiUrl, getHeliusApiKeyFromEnv } from '@/lib/helius-server'
import { SOL_MINT } from '@/lib/portfolio-desk/constants'
import { fetchTokenMarket } from '@/lib/providers/birdeye'
import type { CapturedTrade } from '@/features/terminal-os/ai-trade-like-me/types'
import type { FifoFill } from '@/lib/terminal/portfolio-math'
import { fillsToCapturedTrades } from '@/lib/terminal-os/fills-to-captured-trades'

export { fillsToCapturedTrades } from '@/lib/terminal-os/fills-to-captured-trades'

type HeliusTokenTransfer = {
  fromUserAccount?: string
  toUserAccount?: string
  mint?: string
  tokenAmount?: number
}

type HeliusNativeTransfer = {
  fromUserAccount?: string
  toUserAccount?: string
  amount?: number
}

type HeliusEnhancedTx = {
  signature?: string
  timestamp?: number
  tokenTransfers?: HeliusTokenTransfer[]
  nativeTransfers?: HeliusNativeTransfer[]
}

export type WalletTradeCaptureMeta = {
  source: 'helius_enhanced' | 'unavailable'
  pricedFills: number
  closedRounds: number
  openBuysRecorded: number
  unpricedMoves: number
  /** True when DNA should refuse to train (not enough closed priced rounds) */
  insufficient: boolean
  reason?: string
}

export type WalletTradeCaptureResult = {
  trades: CapturedTrade[]
  meta: WalletTradeCaptureMeta
}

export const MIN_CLOSED_FOR_DNA = 3

function lamportsToSol(raw: number | string | undefined): number {
  if (raw == null) return 0
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (!Number.isFinite(n)) return 0
  return n / 1e9
}

async function fetchEnhancedTxs(wallet: string, limit = 100): Promise<HeliusEnhancedTx[] | null> {
  if (!getHeliusApiKeyFromEnv()) return null
  try {
    const url = buildHeliusApiUrl(`/addresses/${wallet}/transactions`, { limit })
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as unknown
    return Array.isArray(body) ? (body as HeliusEnhancedTx[]) : null
  } catch {
    return null
  }
}

/** Keep in sync with buildsFillsFromTxs in portfolio-analytics.ts */
function buildPricedFills(
  wallet: string,
  txs: HeliusEnhancedTx[],
  solUsd: number,
): { fills: FifoFill[]; pricedCount: number; unpricedTokenMoves: number } {
  const fills: FifoFill[] = []
  let pricedCount = 0
  let unpricedTokenMoves = 0
  const ordered = [...txs].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

  for (const tx of ordered) {
    const ts = (tx.timestamp ?? 0) * 1000
    if (!(ts > 0)) continue

    const relevant = (tx.tokenTransfers ?? []).filter(
      (t) =>
        t.mint &&
        t.mint !== SOL_MINT &&
        typeof t.tokenAmount === 'number' &&
        t.tokenAmount > 0 &&
        (t.fromUserAccount === wallet || t.toUserAccount === wallet),
    )
    if (!relevant.length) continue

    let solOut = 0
    let solIn = 0
    for (const n of tx.nativeTransfers ?? []) {
      const sol = lamportsToSol(n.amount)
      if (!(sol > 0)) continue
      if (n.fromUserAccount === wallet) solOut += sol
      if (n.toUserAccount === wallet) solIn += sol
    }

    const buys = relevant.filter((t) => t.toUserAccount === wallet)
    const sells = relevant.filter((t) => t.fromUserAccount === wallet)

    if (buys.length && solOut > 0 && solUsd > 0) {
      const costUsd = solOut * solUsd
      const totalTok = buys.reduce((s, t) => s + (t.tokenAmount ?? 0), 0)
      if (totalTok > 0) {
        for (const t of buys) {
          const qty = t.tokenAmount!
          const share = qty / totalTok
          const priceUsd = (costUsd * share) / qty
          fills.push({ mint: t.mint!, side: 'buy', qty, priceUsd, ts })
          pricedCount += 1
        }
      }
    } else if (buys.length) {
      unpricedTokenMoves += buys.length
    }

    if (sells.length && solIn > 0 && solUsd > 0) {
      const proceedsUsd = solIn * solUsd
      const totalTok = sells.reduce((s, t) => s + (t.tokenAmount ?? 0), 0)
      if (totalTok > 0) {
        for (const t of sells) {
          const qty = t.tokenAmount!
          const share = qty / totalTok
          const priceUsd = (proceedsUsd * share) / qty
          fills.push({ mint: t.mint!, side: 'sell', qty, priceUsd, ts })
          pricedCount += 1
        }
      }
    } else if (sells.length) {
      unpricedTokenMoves += sells.length
    }
  }

  return { fills, pricedCount, unpricedTokenMoves }
}

/**
 * Capture priced wallet trades for DNA. Returns empty trades + insufficient
 * when Helius/pricing cannot reconstruct real fills — never signature stubs.
 */
export async function captureWalletTradesForDna(
  wallet: string,
): Promise<WalletTradeCaptureResult> {
  const solMarket = await fetchTokenMarket(SOL_MINT)
  const solUsd = solMarket?.priceUsd && solMarket.priceUsd > 0 ? solMarket.priceUsd : 0
  const txs = await fetchEnhancedTxs(wallet, 100)

  if (!txs) {
    return {
      trades: [],
      meta: {
        source: 'unavailable',
        pricedFills: 0,
        closedRounds: 0,
        openBuysRecorded: 0,
        unpricedMoves: 0,
        insufficient: true,
        reason: !getHeliusApiKeyFromEnv()
          ? 'HELIUS_API_KEY not configured — cannot reconstruct fills'
          : 'Helius enhanced history unavailable',
      },
    }
  }

  if (!(solUsd > 0)) {
    return {
      trades: [],
      meta: {
        source: 'unavailable',
        pricedFills: 0,
        closedRounds: 0,
        openBuysRecorded: 0,
        unpricedMoves: 0,
        insufficient: true,
        reason: 'SOL USD mark unavailable — cannot price fills honestly',
      },
    }
  }

  const { fills, pricedCount, unpricedTokenMoves } = buildPricedFills(wallet, txs, solUsd)
  const { trades, closedRounds, openBuysRecorded } = fillsToCapturedTrades(wallet, fills)
  const insufficient = closedRounds < MIN_CLOSED_FOR_DNA

  return {
    trades,
    meta: {
      source: 'helius_enhanced',
      pricedFills: pricedCount,
      closedRounds,
      openBuysRecorded,
      unpricedMoves: unpricedTokenMoves,
      insufficient,
      reason: insufficient
        ? `Need ≥${MIN_CLOSED_FOR_DNA} closed priced round-trips for DNA (found ${closedRounds})`
        : undefined,
    },
  }
}
