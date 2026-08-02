/**
 * Portfolio analytics (Phase 10.5) — server-only.
 *
 * FIFO cost basis is implemented in portfolio-math.ts (see comments there).
 * When transaction history cannot be priced in USD, realizedPnl / avgEntryPrice
 * stay null and `limitations` explains why — never fabricate PnL.
 */

import 'server-only'

import {
  buildHeliusApiUrl,
  getHeliusApiKeyFromEnv,
} from '@/lib/helius-server'
import { SOL_MINT } from '@/lib/portfolio-desk/constants'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { fetchOhlcv, fetchTokenMarket } from '@/lib/providers/birdeye'
import { computeRiskScore } from '@/lib/terminal/scoring'
import {
  applyFifoLots,
  computeHhi,
  logReturns,
  pearsonCorrelation,
  type FifoFill,
  type FifoMintResult,
} from '@/lib/terminal/portfolio-math'
import type {
  AllocationSlice,
  HoldingAnalytics,
  PortfolioAnalytics,
} from '@/types/portfolio-desk'

export {
  applyFifoLots,
  computeHhi,
  logReturns,
  pearsonCorrelation,
} from '@/lib/terminal/portfolio-math'
export type { FifoFill, FifoLot, FifoMintResult } from '@/lib/terminal/portfolio-math'
export type { AllocationSlice, HoldingAnalytics, PortfolioAnalytics } from '@/types/portfolio-desk'

// ── Helius tx → fills ───────────────────────────────────────────────────────

type HeliusTokenTransfer = {
  fromUserAccount?: string
  toUserAccount?: string
  mint?: string
  tokenAmount?: number
  tokenStandard?: string
}

type HeliusNativeTransfer = {
  fromUserAccount?: string
  toUserAccount?: string
  amount?: number
}

type HeliusEnhancedTx = {
  signature?: string
  timestamp?: number
  type?: string
  feePayer?: string
  tokenTransfers?: HeliusTokenTransfer[]
  nativeTransfers?: HeliusNativeTransfer[]
}

async function fetchWalletTransactions(wallet: string, limit = 100): Promise<HeliusEnhancedTx[] | null> {
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

function lamportsToSol(raw: number | string | undefined): number {
  if (raw == null) return 0
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (!Number.isFinite(n)) return 0
  return n / 1e9
}

/**
 * Build USD-priced fills from enhanced txs.
 * Pricing: pair token transfer with SOL native transfer in the same tx
 * (swap-like), using live SOL USD as the conversion (documented limitation).
 */
function buildsFillsFromTxs(
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

    const transfers = tx.tokenTransfers ?? []
    const relevant = transfers.filter(
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

async function correlationForHoldings(
  holdings: Array<{ mint: string; symbol: string; valueUsd: number }>,
): Promise<PortfolioAnalytics['correlationMatrix']> {
  const top = [...holdings].sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 6)
  const mints = top.map((h) => h.mint)
  const symbols = top.map((h) => h.symbol)
  const n = mints.length
  const matrix: (number | null)[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => null),
  )

  if (n < 2) {
    return { mints, symbols, matrix }
  }

  const now = Math.floor(Date.now() / 1000)
  const from = now - 30 * 24 * 60 * 60
  const returns: number[][] = await Promise.all(
    mints.map(async (mint) => {
      const candles = await fetchOhlcv(mint, '1D', from, now)
      const closes = candles.map((c) => c.c).filter((c) => c > 0)
      return logReturns(closes)
    }),
  )

  for (let i = 0; i < n; i++) {
    matrix[i]![i] = 1
    for (let j = i + 1; j < n; j++) {
      const r = pearsonCorrelation(returns[i]!, returns[j]!)
      matrix[i]![j] = r
      matrix[j]![i] = r
    }
  }

  return { mints, symbols, matrix }
}

/**
 * Build full portfolio analytics for a wallet.
 * ~300–1500ms estimated (Helius txs + Birdeye OHLCV for correlation).
 */
/**
 * Lightweight FIFO avg-buy map for open mints — no fabricated prices.
 * Used by capital rotation / holdings enrichment. ~200–800ms when Helius is available.
 */
export async function getAvgBuyByMint(walletAddress: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const solMarket = await fetchTokenMarket(SOL_MINT)
  const solUsd = solMarket?.priceUsd && solMarket.priceUsd > 0 ? solMarket.priceUsd : 0
  if (!(solUsd > 0)) return out
  const txs = await fetchWalletTransactions(walletAddress, 100)
  if (!txs) return out
  const { fills, pricedCount } = buildsFillsFromTxs(walletAddress, txs, solUsd)
  if (pricedCount === 0) return out
  const fifo = applyFifoLots(fills)
  for (const [mint, r] of fifo) {
    if (r.avgEntryPriceUsd != null && r.avgEntryPriceUsd > 0) {
      out.set(mint, r.avgEntryPriceUsd)
    }
  }
  return out
}

export async function buildPortfolioAnalytics(walletAddress: string): Promise<PortfolioAnalytics> {
  const holdingsRes = await buildHoldingsResponse(walletAddress)
  const limitationParts: string[] = []

  const solMarket = await fetchTokenMarket(SOL_MINT)
  const solUsd = solMarket?.priceUsd && solMarket.priceUsd > 0 ? solMarket.priceUsd : 0
  if (!(solUsd > 0)) {
    limitationParts.push('SOL USD mark unavailable — trade USD pricing limited.')
  }

  const txs = await fetchWalletTransactions(walletAddress, 100)
  let fifoByMint = new Map<string, FifoMintResult>()
  let hasCostBasis = false

  if (!txs) {
    limitationParts.push(
      'Helius transaction history unavailable — realized PnL and average entry are null (not fabricated).',
    )
  } else {
    const { fills, pricedCount, unpricedTokenMoves } = buildsFillsFromTxs(
      walletAddress,
      txs,
      solUsd,
    )
    if (pricedCount === 0) {
      limitationParts.push(
        'No SOL-paired swap fills found in recent history — realized PnL and average entry are null.',
      )
    } else {
      fifoByMint = applyFifoLots(fills)
      hasCostBasis = true
      if (unpricedTokenMoves > 0) {
        limitationParts.push(
          `${unpricedTokenMoves} token transfer(s) lacked paired SOL amount and were excluded from cost basis.`,
        )
      }
      limitationParts.push(
        'Fill USD uses live SOL mark × native transfer at trade time (not historical SOL OHLC) — approximate.',
      )
    }
  }

  const riskByMint = new Map<string, number>()
  await Promise.all(
    holdingsRes.holdings.slice(0, 12).map(async (h) => {
      if (h.mint === SOL_MINT) {
        riskByMint.set(h.mint, 5)
        return
      }
      const m = await fetchTokenMarket(h.mint)
      if (m) riskByMint.set(h.mint, computeRiskScore(m))
    }),
  )

  const holdings: HoldingAnalytics[] = holdingsRes.holdings.map((h) => {
    const fifo = fifoByMint.get(h.mint)
    const avgEntry =
      hasCostBasis && fifo?.avgEntryPriceUsd != null && fifo.avgEntryPriceUsd > 0
        ? fifo.avgEntryPriceUsd
        : null
    let unrealized: number | null = null
    if (avgEntry != null && h.amount > 0) {
      unrealized = (h.priceUsd - avgEntry) * h.amount
    }
    return {
      mint: h.mint,
      symbol: h.symbol,
      amount: h.amount,
      valueUsd: h.valueUsd,
      priceUsd: h.priceUsd,
      avgEntryPriceUsd: avgEntry,
      unrealizedPnlUsd: unrealized,
      realizedPnlUsd: hasCostBasis && fifo ? fifo.realizedPnlUsd : null,
      allocationPct: h.allocationPct,
      riskScore: riskByMint.get(h.mint) ?? null,
    }
  })

  let unrealizedPnl: number | null = null
  let realizedPnl: number | null = null
  let winRate: number | null = null

  if (hasCostBasis) {
    unrealizedPnl = holdings.reduce((s, h) => s + (h.unrealizedPnlUsd ?? 0), 0)
    realizedPnl = [...fifoByMint.values()].reduce((s, r) => s + r.realizedPnlUsd, 0)
    const closed = [...fifoByMint.values()].reduce((s, r) => s + r.closedTrades, 0)
    const wins = [...fifoByMint.values()].reduce((s, r) => s + r.winningTrades, 0)
    winRate = closed > 0 ? wins / closed : null
  }

  const allocation: AllocationSlice[] = holdingsRes.holdings.map((h) => ({
    mint: h.mint,
    symbol: h.symbol,
    weight: h.allocationPct / 100,
    valueUsd: h.valueUsd,
  }))

  const weights = allocation.map((a) => a.weight)
  const concentration = computeHhi(weights)
  const diversification = 1 - concentration

  let riskExposure: number | null = null
  const total = holdingsRes.totalValueUsd
  if (total > 0) {
    let acc = 0
    let covered = 0
    for (const h of holdings) {
      if (h.riskScore == null) continue
      acc += h.riskScore * (h.valueUsd / total)
      covered += h.valueUsd
    }
    if (covered / total >= 0.3) riskExposure = Math.round(acc)
  }

  const correlationMatrix = await correlationForHoldings(
    holdingsRes.holdings.map((h) => ({
      mint: h.mint,
      symbol: h.symbol,
      valueUsd: h.valueUsd,
    })),
  )

  const avgEntryByMint: Record<string, number | null> = {}
  for (const h of holdings) {
    avgEntryByMint[h.mint] = h.avgEntryPriceUsd
  }

  return {
    walletAddress: holdingsRes.walletAddress,
    totalValueUsd: holdingsRes.totalValueUsd,
    unrealizedPnl,
    realizedPnl,
    winRate,
    allocation,
    riskExposure,
    concentration,
    diversification,
    correlationMatrix,
    holdings,
    avgEntryByMint,
    limitations: limitationParts.length ? limitationParts.join(' ') : null,
    fetchedAt: new Date().toISOString(),
  }
}
