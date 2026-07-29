import { NextRequest, NextResponse } from 'next/server'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { resolveTokenByQuery } from '@/lib/terminal-os/live-market'
import { resilientTokens } from '@/lib/terminal-os/resilient-feed'
import { scoreTokenFromMarket } from '@/features/terminal-os/shared/lib/score-from-market'
import type { ChainId, TokenRow, TokenScanResult } from '@/features/terminal-os/shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/terminal-os/scan
 * Demo-critical token scan: gateway (Solana mint) + DexScreener market rubric fallback.
 * Never returns blank — always a scored result or soft stale demo score.
 * Never silently scores an unrelated top-list token when the query misses.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string; chain?: string }
    const query = (body.query || 'WIF').trim()
    const chain = (body.chain as ChainId | undefined) || 'all'
    const needle = query.toLowerCase()

    const tokensEnv = await resilientTokens(chain === 'all' ? 'all' : chain, 16)
    const listHit = tokensEnv.data.find(
      (t) =>
        t.symbol.toLowerCase() === needle ||
        t.id.toLowerCase() === needle ||
        (t.pairAddress && t.pairAddress.toLowerCase() === needle),
    )

    let hit: TokenRow | null = listHit ?? null
    let source = tokensEnv.source
    let stale = tokensEnv.stale
    let demo = tokensEnv.demo
    let ageSec = tokensEnv.ageSec
    let fetchedAt = tokensEnv.fetchedAt

    if (!hit) {
      try {
        hit = await resolveTokenByQuery(query, chain)
        if (hit) {
          source = 'dexscreener-search'
          stale = false
          demo = false
          ageSec = 0
          fetchedAt = new Date().toISOString()
        }
      } catch {
        hit = null
      }
    }

    if (!hit) {
      return NextResponse.json({
        result: softFailScan(query),
        meta: { price: 0, vol: 0, liq: 0 },
        stale: true,
        demo: true,
        source: 'demo-fallback',
      })
    }

    let result: TokenScanResult = scoreTokenFromMarket(hit)
    let gatewayUsed = false

    // Solana-looking mint → scan gateway (fast) — ~sub-200ms assessment target
    const looksSolMint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)
    if ((looksSolMint || hit.chain === 'solana') && hit.chain === 'solana') {
      try {
        const mint = query.length >= 32 ? query : hit.id
        // ~150ms estimated when cached / fast depth
        const assess = await assessRiskByMint(mint, 'solana', 'fast')
        gatewayUsed = true
        const safety = assess.safetyScore
        const band =
          safety >= 80 ? 'excellent' : safety >= 65 ? 'good' : safety >= 45 ? 'caution' : 'danger'
        result = {
          ...result,
          mintOrAddress: mint,
          score: safety,
          band,
          riskLabel:
            band === 'excellent'
              ? 'Very Low Risk'
              : band === 'good'
                ? 'Low Risk'
                : band === 'caution'
                  ? 'Elevated Risk'
                  : 'High Risk',
          confidence: Math.round(
            typeof assess.confidence === 'number'
              ? assess.confidence
              : assess.confidence === 'high'
                ? 85
                : assess.confidence === 'medium'
                  ? 65
                  : 45,
          ),
          explanation: `Scan gateway (fast) · safety ${safety} · verdict ${assess.verdict}. Blended with live DexScreener liquidity/volume.`,
          recommendedAction:
            assess.verdict === 'BLOCKED' || assess.verdict === 'HIGH_RISK'
              ? 'Avoid or micro-size — confirm rug heuristics before any swap.'
              : assess.verdict === 'CAUTION'
                ? 'Proceed only with tight size and hard slippage limits.'
                : 'Eligible for normal swap flow — still verify size vs. liquidity.',
        }
      } catch {
        // keep market rubric — never blank
      }
    }

    return NextResponse.json({
      result: { ...result, symbol: hit.symbol },
      meta: { price: hit.priceUsd, vol: hit.volume24hUsd, liq: hit.liquidityUsd },
      stale,
      demo,
      source: gatewayUsed ? `scan-gateway+${source}` : source,
      ageSec,
      fetchedAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json({
      result: softFailScan('UNKNOWN'),
      meta: { price: 0, vol: 0, liq: 0 },
      stale: true,
      demo: true,
      source: 'demo-fallback',
      error: message,
    })
  }
}

function softFailScan(symbol: string): TokenScanResult {
  return {
    mintOrAddress: symbol,
    symbol: symbol.slice(0, 8).toUpperCase(),
    score: 50,
    band: 'caution',
    riskLabel: 'Elevated Risk',
    confidence: 40,
    explanation: 'Provider unavailable — showing labeled demo score. Not a live assessment.',
    recommendedAction: 'Wait for live scan — do not size on demo fallback.',
    metrics: [
      { label: 'Liquidity', value: 50, why: 'Demo fallback' },
      { label: 'Contract Safety', value: 50, why: 'Demo fallback' },
      { label: 'Holders', value: 50, why: 'Demo fallback' },
      { label: 'Dev Activity', value: 50, why: 'Demo fallback' },
      { label: 'Community', value: 50, why: 'Demo fallback' },
    ],
  }
}
