/**
 * GET /api/market/screener/search?q=
 * Symbol / name / mint lookup.
 * Primary: Birdeye V3 search. Fallback: cached multi-source index + known majors.
 * Exact mint fast-path via overview / DexScreener.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cacheGetJson, cacheSetJson } from '@/lib/cache/ttl'
import {
  fetchTokenList,
  fetchTokenOverview,
  fetchTrending,
  searchTokens,
} from '@/lib/providers/birdeye'
import type { ScreenerRow } from '@/lib/providers/types'
import { metricsToScreenerRow } from '@/lib/terminal/market-feed-helpers'
import {
  computeAiScore,
  computeRiskScore,
  computeSmartMoneyScore,
} from '@/lib/terminal/scoring'
import { isValidSolanaAddress } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const INDEX_KEY = 'screener:search-index:v2'
const INDEX_TTL_SEC = 30
const MAX_HITS = 25

/** Always seed majors so SOL/USDC/etc resolve even when list/search are sparse. */
const KNOWN_MAJORS: Array<{ mint: string; symbol: string; name: string }> = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
  },
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'USDT',
  },
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
  },
  {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
  },
  {
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
  },
]

function enrich(row: ScreenerRow): ScreenerRow {
  return {
    ...row,
    riskScore: computeRiskScore(row),
    aiScore: computeAiScore(row),
    smartMoneyScore: computeSmartMoneyScore(row),
  }
}

function seedMajor(m: (typeof KNOWN_MAJORS)[number]): ScreenerRow {
  return enrich(
    metricsToScreenerRow({
      mint: m.mint,
      symbol: m.symbol,
      name: m.name,
      priceUsd: 0,
      change5mPct: 0,
      change1hPct: 0,
      change24hPct: 0,
      volume24hUsd: 0,
      liquidityUsd: 0,
      marketCapUsd: 0,
      fdvUsd: 0,
      holders: 0,
      txCount24h: 0,
      buySellRatio: 0,
    }),
  )
}

async function loadIndex(): Promise<ScreenerRow[]> {
  const hit = await cacheGetJson<ScreenerRow[]>(INDEX_KEY)
  if (hit && Array.isArray(hit) && hit.length) return hit

  const [p0, trending] = await Promise.all([
    fetchTokenList({ sortBy: 'volume', sortType: 'desc', offset: 0, limit: 50 }),
    fetchTrending(20),
  ])
  const seen = new Set<string>()
  const merged: ScreenerRow[] = []
  const push = (row: ScreenerRow) => {
    if (seen.has(row.mint)) return
    seen.add(row.mint)
    merged.push(enrich(row))
  }
  for (const row of [...p0, ...trending]) push(row)
  for (const m of KNOWN_MAJORS) push(seedMajor(m))

  // DexScreener live Solana corpus
  const { fetchDexScreenerScreenerRows } = await import('@/lib/providers/dexscreener')
  const dex = await fetchDexScreenerScreenerRows(16)
  for (const row of dex) push(row)

  if (merged.length) {
    await cacheSetJson(INDEX_KEY, merged, INDEX_TTL_SEC)
  }
  return merged
}

function rankHits(index: ScreenerRow[], q: string): ScreenerRow[] {
  const exact: ScreenerRow[] = []
  const prefix: ScreenerRow[] = []
  const contains: ScreenerRow[] = []
  for (const row of index) {
    const symbol = (row.symbol ?? '').toLowerCase()
    const name = (row.name ?? '').toLowerCase()
    const mint = row.mint.toLowerCase()
    if (mint === q || symbol === q) exact.push(row)
    else if (symbol.startsWith(q) || name.startsWith(q) || mint.startsWith(q)) prefix.push(row)
    else if (symbol.includes(q) || name.includes(q) || mint.includes(q)) contains.push(row)
    if (exact.length + prefix.length + contains.length >= MAX_HITS * 2) break
  }
  return [...exact, ...prefix, ...contains].slice(0, MAX_HITS)
}

async function hydrateSparse(rows: ScreenerRow[]): Promise<ScreenerRow[]> {
  // Fill price for majors / sparse search hits (capped).
  const need = rows.filter((r) => r.priceUsd <= 0).slice(0, 8)
  if (!need.length) return rows.map(enrich)
  const { fetchPrices } = await import('@/lib/providers/jupiter')
  const prices = await fetchPrices(need.map((r) => r.mint))
  return rows.map((r) => {
    const p = prices.get(r.mint)
    if (!p) return enrich(r)
    return enrich({
      ...r,
      priceUsd: r.priceUsd > 0 ? r.priceUsd : p.priceUsd,
      change24hPct:
        r.change24hPct !== 0
          ? r.change24hPct
          : typeof p.change24hPct === 'number'
            ? p.change24hPct
            : r.change24hPct,
    })
  })
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

  // Exact mint fast-path
  if (isValidSolanaAddress(qRaw)) {
    const overview = await fetchTokenOverview(qRaw)
    if (overview) {
      return NextResponse.json({
        hits: [enrich({ ...overview, riskScore: 0, aiScore: 0, isPumpFun: false, isRaydium: false, isGraduated: false, isVerified: false, isTrending: false, smartMoneyScore: 0 })],
        q: qRaw,
        source: 'birdeye',
        latencyMs: Date.now() - t0,
      })
    }
    const { fetchTokenMetricsFromDex } = await import('@/lib/providers/dexscreener')
    const dex = await fetchTokenMetricsFromDex(qRaw)
    if (dex) {
      return NextResponse.json({
        hits: [
          enrich({
            ...dex,
            riskScore: 0,
            aiScore: 0,
            isPumpFun: false,
            isRaydium: false,
            isGraduated: false,
            isVerified: false,
            isTrending: false,
            smartMoneyScore: 0,
          }),
        ],
        q: qRaw,
        source: 'dexscreener',
        latencyMs: Date.now() - t0,
      })
    }
  }

  // Primary: Birdeye V3 keyword search
  // ~80–200ms estimated
  let birdHits = await searchTokens(qRaw, MAX_HITS)
  let source = birdHits.length ? 'birdeye-search' : ''

  // Local multi-source index (majors + list + trending + dex)
  const index = await loadIndex()
  const localHits = rankHits(index, q)

  if (!birdHits.length && localHits.length) {
    birdHits = localHits
    source = 'index'
  } else if (birdHits.length && localHits.length) {
    // Prefer bird order; append unique local matches
    const seen = new Set(birdHits.map((r) => r.mint))
    for (const row of localHits) {
      if (seen.has(row.mint)) continue
      birdHits.push(row)
      seen.add(row.mint)
      if (birdHits.length >= MAX_HITS) break
    }
    source = 'birdeye-search+index'
  }

  if (!birdHits.length) {
    return NextResponse.json({
      hits: [] as ScreenerRow[],
      q: qRaw,
      available: false,
      latencyMs: Date.now() - t0,
    })
  }

  const hits = await hydrateSparse(birdHits.slice(0, MAX_HITS))

  return NextResponse.json({
    hits,
    q: qRaw,
    available: true,
    source,
    latencyMs: Date.now() - t0,
  })
}
