/**
 * Client-safe mark price from DexScreener public API.
 * Never fabricate — null when upstream has no pair/price.
 */

export type MarkQuote = {
  mint: string
  priceUsd: number
  liquidityUsd: number | null
  quotedAt: string
  source: 'dexscreener'
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

export function pickMarkFromDexPayload(mint: string, body: unknown): MarkQuote | null {
  if (!body || typeof body !== 'object') return null
  const pairs = (body as { pairs?: unknown }).pairs
  if (!Array.isArray(pairs) || pairs.length === 0) return null

  let best: { price: number; liq: number } | null = null
  for (const p of pairs) {
    if (!p || typeof p !== 'object') continue
    const row = p as Record<string, unknown>
    const price = toNum(row.priceUsd)
    if (price == null) continue
    const liqRaw = row.liquidity
    const liq =
      liqRaw && typeof liqRaw === 'object'
        ? toNum((liqRaw as { usd?: unknown }).usd) ?? 0
        : 0
    if (!best || liq > best.liq) best = { price, liq }
  }
  if (!best) return null
  return {
    mint,
    priceUsd: best.price,
    liquidityUsd: best.liq > 0 ? best.liq : null,
    quotedAt: new Date().toISOString(),
    source: 'dexscreener',
  }
}

export async function fetchMarkPrice(mint: string): Promise<MarkQuote | null> {
  const m = mint.trim()
  if (m.length < 32) return null
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(m)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body: unknown = await res.json()
    return pickMarkFromDexPayload(m, body)
  } catch {
    return null
  }
}
