/**
 * GET /api/market/screener
 * Virtualized token screener feed (Phase 10.3).
 * Query: sort, order, offset, limit, minLiquidity, maxRisk, minVolume, minAi,
 *        pumpfun, raydium, graduated, verified, trending, new
 * ~80–600ms estimated (Birdeye primary; DexScreener/Jupiter/Helius/Raydium fallbacks).
 */

import { NextRequest, NextResponse } from 'next/server'
import type { ScreenerRow } from '@/lib/providers/types'
import {
  enrichScreenerRows,
  loadScreenerCorpus,
  newsPoolsToScreenerRows,
} from '@/lib/terminal/screener-corpus'
import {
  computeAiScore,
  computeRiskScore,
  computeSmartMoneyScore,
} from '@/lib/terminal/scoring'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LOCAL_SORTS = new Set([
  'riskScore',
  'aiScore',
  'smartMoney',
  'fdv',
  'symbol',
  'token',
  'price', // V3 list has no price sort — local after enrich
])

function parseBool(v: string | null): boolean {
  if (!v) return false
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

function parseNum(v: string | null): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function enrich(row: ScreenerRow): ScreenerRow {
  return {
    ...row,
    riskScore: computeRiskScore(row),
    aiScore: computeAiScore(row),
    smartMoneyScore: computeSmartMoneyScore(row),
  }
}

function sortLocal(rows: ScreenerRow[], sort: string, order: 'asc' | 'desc'): void {
  const dir = order === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    let av = 0
    let bv = 0
    switch (sort) {
      case 'riskScore':
        av = a.riskScore
        bv = b.riskScore
        break
      case 'aiScore':
        av = a.aiScore
        bv = b.aiScore
        break
      case 'smartMoney':
        av = a.smartMoneyScore
        bv = b.smartMoneyScore
        break
      case 'fdv':
        av = a.fdvUsd
        bv = b.fdvUsd
        break
      case 'symbol':
      case 'token':
        return dir * (a.symbol ?? a.name ?? '').localeCompare(b.symbol ?? b.name ?? '')
      case 'volume':
        av = a.volume24hUsd
        bv = b.volume24hUsd
        break
      case 'liquidity':
        av = a.liquidityUsd
        bv = b.liquidityUsd
        break
      case 'marketCap':
        av = a.marketCapUsd
        bv = b.marketCapUsd
        break
      case 'price':
        av = a.priceUsd
        bv = b.priceUsd
        break
      case 'holders':
        av = a.holders
        bv = b.holders
        break
      case 'change24h':
        av = a.change24hPct
        bv = b.change24hPct
        break
      case 'change1h':
        av = a.change1hPct
        bv = b.change1hPct
        break
      case 'change5m':
        av = a.change5mPct
        bv = b.change5mPct
        break
      default:
        av = a.volume24hUsd
        bv = b.volume24hUsd
    }
    return dir * (av - bv)
  })
}

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const sp = req.nextUrl.searchParams

  const sort = (sp.get('sort') || 'volume').trim()
  const order = (sp.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
  const offset = Math.max(0, Math.floor(parseNum(sp.get('offset')) ?? 0))
  const limit = Math.min(Math.max(1, Math.floor(parseNum(sp.get('limit')) ?? 50)), 100)

  const minLiquidity = parseNum(sp.get('minLiquidity'))
  const maxRisk = parseNum(sp.get('maxRisk'))
  const minVolume = parseNum(sp.get('minVolume'))
  const minAi = parseNum(sp.get('minAi'))

  const flags = {
    pumpfun: parseBool(sp.get('pumpfun')),
    raydium: parseBool(sp.get('raydium')),
    graduated: parseBool(sp.get('graduated')),
    verified: parseBool(sp.get('verified')),
    trending: parseBool(sp.get('trending')),
    new: parseBool(sp.get('new')),
  }

  const needsFlagSets = flags.trending || flags.new
  const needsLocal =
    LOCAL_SORTS.has(sort) ||
    maxRisk != null ||
    minVolume != null ||
    minAi != null ||
    flags.pumpfun ||
    flags.raydium ||
    flags.graduated ||
    flags.verified ||
    needsFlagSets

  const fetchLimit = needsLocal ? 50 : Math.min(limit, 50)
  const fetchOffset = needsLocal ? 0 : offset

  const skipTokenList =
    flags.new &&
    !flags.trending &&
    !flags.pumpfun &&
    !flags.raydium &&
    !flags.graduated &&
    !flags.verified

  // ~80–600ms estimated (Birdeye + optional Dex/Jupiter/Helius/Raydium)
  const corpus = await loadScreenerCorpus({
    sortBy: sort,
    sortType: order,
    offset: fetchOffset,
    limit: fetchLimit,
    minLiquidity,
    wantTrending: flags.trending || needsLocal,
    wantNew: flags.new,
    skipTokenList,
  })

  const newsRows = (
    await enrichScreenerRows(newsPoolsToScreenerRows(corpus.news), {
      dexFillLimit: 20,
      heliusFillLimit: 12,
    })
  ).map(enrich)

  const raw = corpus.rows
  const trending = corpus.trending

  if (!raw.length && !trending.length && !newsRows.length) {
    return NextResponse.json({
      rows: [] as ScreenerRow[],
      total: 0,
      offset,
      limit,
      sort,
      order,
      available: false,
      source: corpus.source,
      latencyMs: Date.now() - t0,
    })
  }

  const trendingMints = new Set(trending.map((r) => r.mint))
  const newMints = new Set(corpus.news.map((p) => p.mint))

  let rows: ScreenerRow[]
  if (flags.new && !raw.length) {
    rows = newsRows.map((r) => {
      if (trendingMints.has(r.mint)) r.isTrending = true
      return r
    })
  } else {
    rows = (raw.length ? raw : trending).map((r) => {
      const enriched = enrich(r)
      if (trendingMints.has(enriched.mint)) enriched.isTrending = true
      return enriched
    })
    if (flags.new) {
      rows = newsRows.length ? newsRows : rows.filter((r) => newMints.has(r.mint))
    }
  }

  if (minLiquidity != null) {
    rows = rows.filter((r) => r.liquidityUsd >= minLiquidity)
  }
  if (minVolume != null) {
    rows = rows.filter((r) => r.volume24hUsd >= minVolume)
  }
  if (maxRisk != null) {
    rows = rows.filter((r) => r.riskScore <= maxRisk)
  }
  if (minAi != null) {
    rows = rows.filter((r) => r.aiScore >= minAi)
  }
  if (flags.pumpfun) rows = rows.filter((r) => r.isPumpFun)
  if (flags.raydium) rows = rows.filter((r) => r.isRaydium)
  if (flags.graduated) rows = rows.filter((r) => r.isGraduated)
  if (flags.verified) rows = rows.filter((r) => r.isVerified)
  if (flags.trending) {
    // Prefer explicit trending set; if intersection empties, show trending corpus directly
    const filtered = rows.filter((r) => r.isTrending || trendingMints.has(r.mint))
    rows = filtered.length ? filtered : trending.map(enrich)
  }

  if (needsLocal) {
    sortLocal(rows, sort, order)
  }

  const total = rows.length
  const page = needsLocal ? rows.slice(offset, offset + limit) : rows.slice(0, limit)

  // Phase 16 — Market Intelligence "datapoints analyzed" = rows ingested today.
  void import('@/lib/intelligence/module-stats')
    .then(({ incrMarketDatapoints }) => incrMarketDatapoints(page.length))
    .catch(() => {})

  return NextResponse.json({
    rows: page,
    total,
    offset,
    limit,
    sort,
    order,
    available: true,
    source: corpus.source,
    latencyMs: Date.now() - t0,
  })
}
