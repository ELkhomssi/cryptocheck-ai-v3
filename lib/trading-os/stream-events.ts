/** Canonical poll URL for Trading OS stream ticks (auth + cookies). */
export const TRADING_OS_STREAM_EVENTS_PATH = '/api/trading-os/stream/events'

/** Contract for `GET /api/trading-os/stream/events` (poll or WS mirror). */

export type TradingOsPortfolioSnapshot = {
  id: string
  user_id: string
  mint: string
  entry_price_usd: number | null
  amount_ui: number | null
  meta: Record<string, unknown>
  updated_at: string
}

export type TradingOsStreamEventsResponse = {
  ok: true
  serverTime: string
  portfolios: TradingOsPortfolioSnapshot[]
}

export function isTradingOsStreamEventsResponse(x: unknown): x is TradingOsStreamEventsResponse {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.ok !== true || typeof o.serverTime !== 'string' || !Array.isArray(o.portfolios)) return false
  return o.portfolios.every(isPortfolioSnapshotRow)
}

function isPortfolioSnapshotRow(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.user_id === 'string' &&
    typeof r.mint === 'string' &&
    (r.entry_price_usd === null || typeof r.entry_price_usd === 'number') &&
    (r.amount_ui === null || typeof r.amount_ui === 'number') &&
    r.meta !== null &&
    typeof r.meta === 'object' &&
    typeof r.updated_at === 'string'
  )
}
