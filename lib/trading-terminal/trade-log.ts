import { TRADE_LOG_KEY } from './constants'
import type { TerminalVerdict } from './types'

/**
 * Local trade log written only after confirmed wallet signatures from the terminal ticket.
 * No fabricated fills.
 */

export type TerminalTradeEntry = {
  at: string
  mint: string
  symbol: string
  side: 'buy' | 'sell'
  signature: string
  /** Optional USD notional when known from ticket — never invent. */
  amountUsd?: number
  /** Spot USD at/near fill from DexScreener — never invent. */
  entryPriceUsd?: number
  verdictAtTrade: TerminalVerdict | null
  /** Coach soft-gate was overridden immediately before this trade. */
  coachOverridden: boolean
}

export function parseTradeLog(raw: string | null): TerminalTradeEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: TerminalTradeEntry[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      if (typeof o.at !== 'string' || typeof o.mint !== 'string') continue
      if (typeof o.signature !== 'string' || o.signature.length < 32) continue
      if (o.side !== 'buy' && o.side !== 'sell') continue
      out.push({
        at: o.at,
        mint: o.mint,
        symbol: typeof o.symbol === 'string' ? o.symbol : o.mint.slice(0, 6),
        side: o.side,
        signature: o.signature,
        amountUsd: typeof o.amountUsd === 'number' ? o.amountUsd : undefined,
        entryPriceUsd: typeof o.entryPriceUsd === 'number' ? o.entryPriceUsd : undefined,
        verdictAtTrade: typeof o.verdictAtTrade === 'string' ? (o.verdictAtTrade as TerminalVerdict) : null,
        coachOverridden: Boolean(o.coachOverridden),
      })
    }
    return out
  } catch {
    return []
  }
}

export function loadTradeLog(): TerminalTradeEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return parseTradeLog(window.localStorage.getItem(TRADE_LOG_KEY))
  } catch {
    return []
  }
}

export function appendTrade(entry: TerminalTradeEntry): void {
  if (typeof window === 'undefined') return
  try {
    const prev = loadTradeLog()
    if (prev.some((t) => t.signature === entry.signature)) return
    const next = [entry, ...prev].slice(0, 200)
    window.localStorage.setItem(TRADE_LOG_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
