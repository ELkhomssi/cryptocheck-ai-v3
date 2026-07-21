/**
 * Market ribbon contracts — components read only from MarketStat.
 * Real values come from live loaders; sparklines may use MOCK_ONLY adapter.
 */

export type MarketStatId =
  | 'market_cap'
  | 'volume_24h'
  | 'btc_dominance'
  | 'sol_price'
  | 'active_wallets'
  | 'fear_greed'
  | 'terminal_status'

export type MarketStatTone = 'pos' | 'neg' | 'neutral'

export type MarketStat = {
  id: MarketStatId
  label: string
  /** Formatted display value, or null when feed not yet wired. */
  value: string | null
  /** Signed % change string (e.g. "+1.2%"), or null. */
  changePct: string | null
  tone: MarketStatTone
  /** ~24 sparkline points; empty → render flat baseline. */
  sparkline: number[]
  /** Caption under missing value — never "Unavailable". */
  awaitingCaption: string
  loading: boolean
}

export type TerminalHealthStatus = 'ok' | 'degraded' | 'unknown'

export function awaitingStat(
  id: MarketStatId,
  label: string,
  sparkline: number[] = [],
): MarketStat {
  return {
    id,
    label,
    value: null,
    changePct: null,
    tone: 'neutral',
    sparkline,
    awaitingCaption: 'awaiting feed',
    loading: false,
  }
}

export function loadingStat(id: MarketStatId, label: string): MarketStat {
  return {
    id,
    label,
    value: null,
    changePct: null,
    tone: 'neutral',
    sparkline: [],
    awaitingCaption: 'loading…',
    loading: true,
  }
}
