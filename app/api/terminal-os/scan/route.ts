import { NextRequest, NextResponse } from 'next/server'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { resilientTokens } from '@/lib/terminal-os/resilient-feed'
import { scoreTokenFromMarket } from '@/features/terminal-os/shared/lib/score-from-market'
import type { TokenScanResult } from '@/features/terminal-os/shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/terminal-os/scan
 * Scan gateway (Solana mint) + DexScreener market rubric.
 * Never silently substitutes another token. Never fabricates a score on failure.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string; chain?: string }
    const query = (body.query || '').trim()
    if (!query) {
      return NextResponse.json(
        { error: 'token query required', notFound: true },
        { status: 400 },
      )
    }

    const tokensEnv = await resilientTokens('all', 16)
    const needle = query.toLowerCase()
    const hit = tokensEnv.data.find(
      (t) =>
        t.symbol.toLowerCase() === needle ||
        t.id.toLowerCase() === needle ||
        t.name.toLowerCase() === needle ||
        (t.pairAddress && t.pairAddress.toLowerCase() === needle),
    )

    if (!hit) {
      // Try mint-shaped Solana query via gateway even if not in top tokens
      const looksSolMint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)
      if (looksSolMint) {
        try {
          const assess = await assessRiskByMint(query, 'solana', 'fast')
          const safety = assess.safetyScore
          const band =
            safety >= 80 ? 'excellent' : safety >= 65 ? 'good' : safety >= 45 ? 'caution' : 'danger'
          const result: TokenScanResult = {
            mintOrAddress: query,
            symbol: query.slice(0, 4).toUpperCase(),
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
            explanation: `Scan gateway (fast) · safety ${safety} · verdict ${assess.verdict}.`,
            recommendedAction: `Risk band: ${assess.verdict} (scan gateway) — Decision Engine synthesizes act.`,
            metrics: [],
          }
          return NextResponse.json({
            result,
            meta: { price: 0, vol: 0, liq: 0 },
            stale: false,
            demo: false,
            source: 'scan-gateway',
          })
        } catch {
          /* fall through to not found */
        }
      }

      return NextResponse.json(
        {
          error: 'Token not found',
          notFound: true,
          query,
          result: null,
          unavailable: true,
        },
        { status: 404 },
      )
    }

    let result: TokenScanResult = scoreTokenFromMarket(hit)
    let gatewayUsed = false

    const looksSolMint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query) || hit.chain === 'solana'
    if (looksSolMint && hit.chain === 'solana') {
      try {
        const mint = query.length >= 32 ? query : hit.id
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
          recommendedAction: `Risk band: ${assess.verdict} (scan gateway) — Decision Engine synthesizes act.`,
        }
      } catch {
        // Keep market rubric only — do not fabricate a soft-fail score
      }
    }

    return NextResponse.json({
      result: { ...result, symbol: hit.symbol },
      meta: { price: hit.priceUsd, vol: hit.volume24hUsd, liq: hit.liquidityUsd },
      stale: tokensEnv.stale,
      demo: tokensEnv.demo,
      source: gatewayUsed ? `scan-gateway+${tokensEnv.source}` : tokensEnv.source,
      ageSec: tokensEnv.ageSec,
      fetchedAt: tokensEnv.fetchedAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json(
      {
        error: message,
        unavailable: true,
        result: null,
        meta: { price: 0, vol: 0, liq: 0 },
        stale: true,
        demo: false,
        source: 'scan-unavailable',
      },
      { status: 503 },
    )
  }
}
