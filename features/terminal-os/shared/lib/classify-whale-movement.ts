/**
 * Pure whale classification model — unit-testable without network.
 * Phase 1 heuristic; replace scoring weights in Phase 2 with richer signals.
 */

import type { WhaleAction, WhaleClassification, WhaleMovement } from '../types'

export type WhaleClassifyInput = Pick<WhaleMovement, 'action' | 'usdValue'> & {
  /** Prefer upstream label when the feed already classified the event */
  classification?: WhaleClassification
  /** Optional signals for richer classification later */
  isKnownDevWallet?: boolean
  priceChangePctSinceEntry?: number
  liquidityDeltaPct?: number
  isNewToken?: boolean
}

/**
 * classifyWhaleMovement — buckets a whale event for the live ticker.
 * Prefer explicit override if already labeled by upstream (sample/mock).
 */
export function classifyWhaleMovement(event: WhaleClassifyInput): WhaleClassification {
  if (event.classification) return event.classification

  const { action, usdValue } = event
  if (event.isKnownDevWallet && (action === 'sell' || action === 'withdraw')) {
    return 'Possible Rug'
  }
  if (event.isNewToken && action === 'sell' && usdValue > 50_000) {
    return 'Possible Rug'
  }
  if (action === 'withdraw' && (event.liquidityDeltaPct ?? 0) < -20) {
    return 'Liquidity Migration'
  }
  if (action === 'deposit' || (action === 'buy' && usdValue >= 250_000)) {
    return 'High Conviction Buy'
  }
  if (action === 'buy') return 'Accumulation'
  if (action === 'sell' && (event.priceChangePctSinceEntry ?? 0) > 40) {
    return 'Profit Taking'
  }
  if (action === 'sell' || action === 'withdraw') return 'Distribution'
  if (action === 'swap' && (event.liquidityDeltaPct ?? 0) > 15) {
    return 'Liquidity Migration'
  }
  if (action === 'transfer') return 'Liquidity Migration'
  return 'Exit Signal'
}
