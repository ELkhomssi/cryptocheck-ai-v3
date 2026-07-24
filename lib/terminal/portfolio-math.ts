/**
 * Pure portfolio math helpers (FIFO, HHI, correlation).
 * Safe for unit tests — no server-only / network imports.
 *
 * FIFO cost basis (documented):
 * - Chronological fills only (oldest first).
 * - Each buy opens a lot { qty, unitCostUsd } appended to that mint's queue.
 * - Each sell consumes from the front of the queue (first-in, first-out).
 * - Realized PnL on a sell = Σ (sellPriceUsd − lot.unitCostUsd) × qtyTaken.
 * - Remaining lots → avgEntryPriceUsd = remainingCost / remainingQty.
 */

export type FifoLot = {
  qty: number
  unitCostUsd: number
  ts: number
}

export type FifoFill = {
  mint: string
  side: 'buy' | 'sell'
  qty: number
  /** USD per token unit at fill time. Required for honest PnL. */
  priceUsd: number
  ts: number
}

export type FifoMintResult = {
  mint: string
  remainingQty: number
  remainingCostUsd: number
  avgEntryPriceUsd: number | null
  realizedPnlUsd: number
  closedTrades: number
  winningTrades: number
}

/**
 * Apply FIFO lot accounting across chronological fills.
 * Fills with non-finite / non-positive qty or price are skipped.
 */
export function applyFifoLots(fills: FifoFill[]): Map<string, FifoMintResult> {
  const byMint = new Map<string, FifoLot[]>()
  const realized = new Map<string, number>()
  const closed = new Map<string, number>()
  const wins = new Map<string, number>()

  const ordered = [...fills].sort((a, b) => a.ts - b.ts || a.mint.localeCompare(b.mint))

  for (const f of ordered) {
    if (!(f.qty > 0) || !(f.priceUsd > 0) || !Number.isFinite(f.qty) || !Number.isFinite(f.priceUsd)) {
      continue
    }
    if (!byMint.has(f.mint)) byMint.set(f.mint, [])
    const lots = byMint.get(f.mint)!

    if (f.side === 'buy') {
      lots.push({ qty: f.qty, unitCostUsd: f.priceUsd, ts: f.ts })
      continue
    }

    let qtyLeft = f.qty
    let tradePnl = 0
    let traded = 0
    while (qtyLeft > 1e-12 && lots.length) {
      const lot = lots[0]!
      const take = Math.min(lot.qty, qtyLeft)
      tradePnl += (f.priceUsd - lot.unitCostUsd) * take
      lot.qty -= take
      qtyLeft -= take
      traded += take
      if (lot.qty <= 1e-12) lots.shift()
    }
    if (traded > 0) {
      realized.set(f.mint, (realized.get(f.mint) ?? 0) + tradePnl)
      closed.set(f.mint, (closed.get(f.mint) ?? 0) + 1)
      if (tradePnl > 0) wins.set(f.mint, (wins.get(f.mint) ?? 0) + 1)
    }
  }

  const mints = new Set([...byMint.keys(), ...realized.keys()])
  const out = new Map<string, FifoMintResult>()
  for (const mint of mints) {
    const lots = byMint.get(mint) ?? []
    let remainingQty = 0
    let remainingCostUsd = 0
    for (const lot of lots) {
      remainingQty += lot.qty
      remainingCostUsd += lot.qty * lot.unitCostUsd
    }
    out.set(mint, {
      mint,
      remainingQty,
      remainingCostUsd,
      avgEntryPriceUsd: remainingQty > 1e-12 ? remainingCostUsd / remainingQty : null,
      realizedPnlUsd: realized.get(mint) ?? 0,
      closedTrades: closed.get(mint) ?? 0,
      winningTrades: wins.get(mint) ?? 0,
    })
  }
  return out
}

/** Herfindahl–Hirschman Index on allocation weights (0–1 each). */
export function computeHhi(weights: number[]): number {
  let hhi = 0
  for (const w of weights) {
    if (!Number.isFinite(w) || w <= 0) continue
    hhi += w * w
  }
  return hhi
}

/** Pearson correlation of two equal-length series. null if undefined. */
export function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 3) return null
  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i++) {
    sumA += a[i]!
    sumB += b[i]!
  }
  const meanA = sumA / n
  const meanB = sumB / n
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA
    const db = b[i]! - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const den = Math.sqrt(denA * denB)
  if (!(den > 0)) return null
  const r = num / den
  if (!Number.isFinite(r)) return null
  return Math.max(-1, Math.min(1, r))
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!
    const cur = closes[i]!
    if (!(prev > 0) || !(cur > 0)) continue
    out.push(Math.log(cur / prev))
  }
  return out
}
