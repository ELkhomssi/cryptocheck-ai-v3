import type { TerminalTradeEntry } from './trade-log'

/**
 * Outcome math from real entry mark + later mark.
 * Without both prices, status is unavailable — never invent USD PnL.
 */

export type TradeOutcomeStatus = 'unavailable' | 'marked'

export type TradeOutcome = {
  trade: TerminalTradeEntry
  status: TradeOutcomeStatus
  entryPriceUsd: number | null
  markPriceUsd: number | null
  /** Price change % in trade direction (buy: mark/entry-1; sell: entry/mark-1). */
  priceDeltaPct: number | null
  markAt: string | null
  note: string
}

export function computeTradeOutcome(
  trade: TerminalTradeEntry,
  markPriceUsd: number | null,
  markAt: string | null = null,
): TradeOutcome {
  const entry = trade.entryPriceUsd ?? null
  if (entry == null || !(entry > 0) || markPriceUsd == null || !(markPriceUsd > 0)) {
    return {
      trade,
      status: 'unavailable',
      entryPriceUsd: entry,
      markPriceUsd,
      priceDeltaPct: null,
      markAt,
      note:
        entry == null
          ? 'No entry mark captured at fill — price Δ withheld.'
          : 'Mark price unavailable from DexScreener.',
    }
  }

  const raw = trade.side === 'buy' ? markPriceUsd / entry - 1 : entry / markPriceUsd - 1
  return {
    trade,
    status: 'marked',
    entryPriceUsd: entry,
    markPriceUsd,
    priceDeltaPct: raw * 100,
    markAt,
    note: 'Price Δ only (not position PnL — size not in local log).',
  }
}

export function summarizeOutcomes(outcomes: TradeOutcome[]): {
  marked: number
  unavailable: number
  avgDeltaPct: number | null
} {
  const marked = outcomes.filter((o) => o.status === 'marked' && o.priceDeltaPct != null)
  const unavailable = outcomes.length - marked.length
  if (marked.length === 0) {
    return { marked: 0, unavailable, avgDeltaPct: null }
  }
  const avg = marked.reduce((s, o) => s + (o.priceDeltaPct as number), 0) / marked.length
  return { marked: marked.length, unavailable, avgDeltaPct: avg }
}
