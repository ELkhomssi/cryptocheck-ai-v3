/**
 * Pure Birdeye response mappers — keep in sync with lib/providers/birdeye.ts.
 * Safe for unit tests (no server-only / network).
 */

import type { ScreenerRow, TokenMarketMetrics } from '@/lib/providers/types'

export function birdeyeNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export function birdeyeStr(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return undefined
}

export function birdeyeBuySellRatio(buy: unknown, sell: unknown): number {
  const b = birdeyeNum(buy)
  const s = birdeyeNum(sell)
  if (s <= 0) return b > 0 ? b : 0
  return b / s
}

/** First finite number across camelCase / snake_case / alias keys. */
export function pickBirdeyeNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (k in row) {
      const n = birdeyeNum(row[k], Number.NaN)
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

/**
 * Normalize a Birdeye overview / list / trending / v3 item → TokenMarketMetrics.
 * Accepts legacy camelCase and V3 snake_case field names.
 */
export function mapBirdeyeRowToMetrics(
  mint: string,
  d: Record<string, unknown>,
): TokenMarketMetrics {
  return {
    mint,
    symbol: birdeyeStr(d.symbol, d.symbols),
    name: birdeyeStr(d.name),
    priceUsd: pickBirdeyeNum(d, ['price', 'priceUsd', 'value']),
    change5mPct: pickBirdeyeNum(d, [
      'priceChange5mPercent',
      'price_change_5m_percent',
      'price5mChangePercent',
      'v5mChangePercent',
    ]),
    change1hPct: pickBirdeyeNum(d, [
      'priceChange1hPercent',
      'price_change_1h_percent',
      'price1hChangePercent',
      'v1hChangePercent',
    ]),
    change24hPct: pickBirdeyeNum(d, [
      'priceChange24hPercent',
      'price_change_24h_percent',
      'price24hChangePercent',
      'v24hChangePercent',
    ]),
    volume24hUsd: pickBirdeyeNum(d, [
      'v24hUSD',
      'volume24hUSD',
      'volume_24h_usd',
      'volumeUSD',
      'volume',
    ]),
    liquidityUsd: pickBirdeyeNum(d, ['liquidity', 'liquidityUsd', 'liquidity_usd']),
    marketCapUsd: pickBirdeyeNum(d, [
      'marketCap',
      'market_cap',
      'marketcap',
      'mc',
      'realMc',
    ]),
    fdvUsd: pickBirdeyeNum(d, ['fdv', 'fullyDilutedValuation']),
    holders: Math.max(
      0,
      Math.floor(pickBirdeyeNum(d, ['holder', 'holders', 'holderCount', 'uniqueWallet24h'])),
    ),
    txCount24h: Math.max(
      0,
      Math.floor(
        pickBirdeyeNum(d, ['trade24h', 'trade_24h_count', 'trade24hCount', 'txns24h', 'txs24h']),
      ),
    ),
    buySellRatio: birdeyeBuySellRatio(
      d.buy24h ?? d.buy_24h ?? d.buy,
      d.sell24h ?? d.sell_24h ?? d.sell,
    ),
    logoUrl: birdeyeStr(d.logoURI, d.logo_uri, d.logoUrl, d.logo),
  }
}

export function mapBirdeyeRowToScreener(
  row: Record<string, unknown>,
  extras: Partial<Pick<ScreenerRow, 'isTrending'>> = {},
): ScreenerRow | null {
  const mint =
    birdeyeStr(row.address, row.mint, row.tokenAddress, row.token_address) ?? ''
  if (!mint) return null
  const base = mapBirdeyeRowToMetrics(mint, row)
  return {
    ...base,
    riskScore: 0,
    aiScore: 0,
    isPumpFun: Boolean(row.isPumpFun ?? row.is_pump_fun),
    isRaydium: Boolean(row.isRaydium ?? row.is_raydium),
    isGraduated: Boolean(row.isGraduated ?? row.is_graduated),
    isVerified: Boolean(row.isVerified ?? row.verified),
    isTrending: Boolean(extras.isTrending ?? row.isTrending),
    smartMoneyScore: pickBirdeyeNum(row, [
      'smartMoneyScore',
      'smart_money_score',
      'smartMoney',
      'smart_money',
    ]),
  }
}

/** Extract token arrays from Birdeye list/trending/v3 envelopes. */
export function extractBirdeyeTokenRows(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return []
  const root = body as Record<string, unknown>
  const data = root.data

  if (Array.isArray(data)) {
    return data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
  }
  if (!data || typeof data !== 'object') return []
  const d = data as Record<string, unknown>
  for (const key of ['tokens', 'items', 'list', 'result'] as const) {
    const arr = d[key]
    if (Array.isArray(arr)) {
      return arr.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    }
  }
  return []
}

/** Map legacy screener sort keys → Birdeye V3 `sort_by` enum. */
export const SCREENER_SORT_TO_BIRDEYE_V3: Record<string, string> = {
  volume: 'volume_24h_usd',
  liquidity: 'liquidity',
  marketCap: 'market_cap',
  holders: 'holder',
  change24h: 'price_change_24h_percent',
  change1h: 'price_change_1h_percent',
  change5m: 'price_change_5m_percent',
  fdv: 'fdv',
  // legacy Birdeye tokenlist keys (market-feeds / older callers)
  v24hUSD: 'volume_24h_usd',
  v24hChangePercent: 'price_change_24h_percent',
  v1hChangePercent: 'price_change_1h_percent',
  v5mChangePercent: 'price_change_5m_percent',
  mc: 'market_cap',
  holder: 'holder',
  price: 'liquidity', // V3 has no price sort — nearest useful proxy
}

/** Legacy `/defi/tokenlist` sort_by values. */
export const SCREENER_SORT_TO_BIRDEYE_LEGACY: Record<string, string> = {
  volume: 'v24hUSD',
  liquidity: 'liquidity',
  marketCap: 'mc',
  price: 'price',
  holders: 'holder',
  change24h: 'v24hChangePercent',
  change1h: 'v1hChangePercent',
  change5m: 'v5mChangePercent',
  v24hUSD: 'v24hUSD',
  v24hChangePercent: 'v24hChangePercent',
  v1hChangePercent: 'v1hChangePercent',
  v5mChangePercent: 'v5mChangePercent',
  mc: 'mc',
  holder: 'holder',
}
