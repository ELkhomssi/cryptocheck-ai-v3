/**
 * Enrich Discover rows with DexScreener price / mcap / 24h Δ.
 * Client-side only; honest zeros when feed fails. ~150–400ms per batch.
 */

import type { DiscoverToken } from './data/types'

type DsPair = {
  chainId?: string
  priceUsd?: string
  priceChange?: { h24?: number }
  marketCap?: number
  fdv?: number
  volume?: { h24?: number }
}

type CacheEntry = {
  priceUsd: number
  changePct: number
  marketCapUsd: number
  at: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 45_000

function readCache(mint: string): CacheEntry | null {
  const hit = cache.get(mint)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(mint)
    return null
  }
  return hit
}

/** Batch-fetch DexScreener quotes for Solana mints (max 30). */
export async function fetchDexQuotes(
  mints: string[],
): Promise<Map<string, CacheEntry>> {
  const out = new Map<string, CacheEntry>()
  const need: string[] = []
  for (const m of mints) {
    if (!m || m.length < 32 || m.startsWith('Demo')) continue
    const hit = readCache(m)
    if (hit) out.set(m, hit)
    else need.push(m)
  }
  if (need.length === 0) return out

  const batch = need.slice(0, 30)
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return out
    const body = (await res.json()) as { pairs?: DsPair[] | null }
    const pairs = body.pairs ?? []
    const best = new Map<string, DsPair>()
    for (const p of pairs) {
      if (p.chainId !== 'solana') continue
      // DexScreener token endpoint returns pairs; mint is in pair base/quote — match by scanning request batch via price presence
      // API returns pairs for any of the tokens; we map via address fields when present
      const raw = p as DsPair & {
        baseToken?: { address?: string }
        quoteToken?: { address?: string }
      }
      const addr =
        batch.find(
          (m) =>
            raw.baseToken?.address === m || raw.quoteToken?.address === m,
        ) ?? null
      if (!addr) continue
      const prev = best.get(addr)
      const vol = p.volume?.h24 ?? 0
      const prevVol = prev?.volume?.h24 ?? 0
      if (!prev || vol > prevVol) best.set(addr, p)
    }
    const now = Date.now()
    for (const [mint, p] of best) {
      const entry: CacheEntry = {
        priceUsd: Number(p.priceUsd) || 0,
        changePct: typeof p.priceChange?.h24 === 'number' ? p.priceChange.h24 : 0,
        marketCapUsd: Number(p.marketCap ?? p.fdv ?? 0) || 0,
        at: now,
      }
      cache.set(mint, entry)
      out.set(mint, entry)
    }
  } catch {
    /* keep partial cache */
  }
  return out
}

/** Merge Dex quotes into DiscoverToken rows (immutable). */
export function applyDexQuotes(
  rows: DiscoverToken[],
  quotes: Map<string, CacheEntry>,
): DiscoverToken[] {
  return rows.map((r) => {
    const q = quotes.get(r.mint)
    if (!q) return r
    return {
      ...r,
      priceUsd: q.priceUsd > 0 ? q.priceUsd : r.priceUsd,
      changePct: q.changePct !== 0 ? q.changePct : r.changePct,
      marketCapUsd: q.marketCapUsd > 0 ? q.marketCapUsd : r.marketCapUsd,
    }
  })
}
