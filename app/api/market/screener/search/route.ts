/**
 * GET /api/market/screener/search?q=
 * Indexed symbol / name / mint lookup over a cached Birdeye token list.
 * Target sub-300ms via Redis/memory (providers cachedJson) + exact mint fast-path.
 * Returns max 25 hits. Empty when Birdeye unavailable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cacheGetJson, cacheSetJson } from '@/lib/cache/ttl'
import { fetchTokenList, fetchTokenOverview } from '@/lib/providers/birdeye'
import type { ScreenerRow } from '@/lib/providers/types'
import {
  computeAiScore,
  computeRiskScore,
  computeSmartMoneyScore,
} from '@/lib/terminal/scoring'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const INDEX_KEY = 'screener:search-index:v1'
const INDEX_TTL_SEC = 30
const MAX_HITS = 25
const BASE58_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

function enrich(row: ScreenerRow): ScreenerRow {
  return {
    ...row,
    riskScore: computeRiskScore(row),
    aiScore: computeAiScore(row),
    smartMoneyScore: computeSmartMoneyScore(row),
  }
}

async function loadIndex(): Promise<ScreenerRow[]> {
  const hit = await cacheGetJson<ScreenerRow[]>(INDEX_KEY)
  if (hit && Array.isArray(hit) && hit.length) return hit

  // Pull top volume pages for search corpus (cached ~20s inside fetchTokenList).
  const [p0, p1] = await Promise.all([
    fetchTokenList({ sortBy: 'v24hUSD', sortType: 'desc', offset: 0, limit: 50 }),
    fetchTokenList({ sortBy: 'v24hUSD', sortType: 'desc', offset: 50, limit: 50 }),
  ])
  const seen = new Set<string>()
  const merged: ScreenerRow[] = []
  for (const row of [...p0, ...p1]) {
    if (seen.has(row.mint)) continue
    seen.add(row.mint)
    merged.push(enrich(row))
  }

  // DexScreener fallback when Birdeye index empty
  if (!merged.length) {
    const { fetchDexScreenerScreenerRows } = await import('@/lib/providers/dexscreener')
    const dex = await fetchDexScreenerScreenerRows(16)
    for (const row of dex) {
      if (seen.has(row.mint)) continue
      seen.add(row.mint)
      merged.push(enrich(row))
    }
  }

  if (merged.length) {
    await cacheSetJson(INDEX_KEY, merged, INDEX_TTL_SEC)
  }
  return merged
}

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const qRaw = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!qRaw || qRaw.length < 1) {
    return NextResponse.json({
      hits: [] as ScreenerRow[],
      q: qRaw,
      latencyMs: Date.now() - t0,
    })
  }

  const q = qRaw.toLowerCase()

  // Exact mint fast-path — overview is TTL-cached; DexScreener if Birdeye miss.
  if (BASE58_MINT.test(qRaw)) {
    const overview = await fetchTokenOverview(qRaw)
    if (overview) {
      const row: ScreenerRow = enrich({
        ...overview,
        riskScore: 0,
        aiScore: 0,
        isPumpFun: false,
        isRaydium: false,
        isGraduated: false,
        isVerified: false,
        isTrending: false,
        smartMoneyScore: 0,
      })
      return NextResponse.json({
        hits: [row],
        q: qRaw,
        latencyMs: Date.now() - t0,
      })
    }
    const { fetchTokenMetricsFromDex } = await import('@/lib/providers/dexscreener')
    const dex = await fetchTokenMetricsFromDex(qRaw)
    if (dex) {
      const row: ScreenerRow = enrich({
        ...dex,
        riskScore: 0,
        aiScore: 0,
        isPumpFun: false,
        isRaydium: false,
        isGraduated: false,
        isVerified: false,
        isTrending: false,
        smartMoneyScore: 0,
      })
      return NextResponse.json({
        hits: [row],
        q: qRaw,
        source: 'dexscreener',
        latencyMs: Date.now() - t0,
      })
    }
  }

  const index = await loadIndex()
  if (!index.length) {
    return NextResponse.json({
      hits: [] as ScreenerRow[],
      q: qRaw,
      available: false,
      latencyMs: Date.now() - t0,
    })
  }

  const exact: ScreenerRow[] = []
  const prefix: ScreenerRow[] = []
  const contains: ScreenerRow[] = []

  for (const row of index) {
    const symbol = (row.symbol ?? '').toLowerCase()
    const name = (row.name ?? '').toLowerCase()
    const mint = row.mint.toLowerCase()

    if (mint === q || symbol === q) {
      exact.push(row)
    } else if (symbol.startsWith(q) || name.startsWith(q) || mint.startsWith(q)) {
      prefix.push(row)
    } else if (symbol.includes(q) || name.includes(q) || mint.includes(q)) {
      contains.push(row)
    }
    if (exact.length + prefix.length + contains.length >= MAX_HITS * 2) break
  }

  const hits = [...exact, ...prefix, ...contains].slice(0, MAX_HITS)

  return NextResponse.json({
    hits,
    q: qRaw,
    available: true,
    latencyMs: Date.now() - t0,
  })
}
