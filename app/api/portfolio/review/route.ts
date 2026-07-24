/**
 * POST /api/portfolio/review
 * Body: { walletAddress }
 * Fetches analytics + light market context, asks Claude for structured
 * per-holding recommendations. Server-only ANTHROPIC_API_KEY.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { fetchTrending } from '@/lib/providers/birdeye'
import { isValidSolanaWallet } from '@/lib/portfolio-desk/validate'
import { buildPortfolioAnalytics } from '@/lib/terminal/portfolio-analytics'
import type {
  HoldingRecommendation,
  PortfolioReviewResponse,
  ReviewAction,
} from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DISCLAIMER =
  'Not financial advice · DYOR. Recommendations are informational only and may be wrong.'

const ACTIONS = new Set<ReviewAction>(['Hold', 'Buy', 'Reduce', 'Exit'])

function parseRecommendations(raw: string, known: Map<string, string>): HoldingRecommendation[] {
  // Prefer fenced JSON or bare object
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) text = fence[1].trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1))
      } catch {
        return []
      }
    } else {
      return []
    }
  }

  const root = parsed as { recommendations?: unknown[] }
  if (!Array.isArray(root.recommendations)) return []

  const out: HoldingRecommendation[] = []
  for (const row of root.recommendations) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const mint = typeof r.mint === 'string' ? r.mint.trim() : ''
    if (!mint || !known.has(mint)) continue
    const actionRaw = typeof r.action === 'string' ? r.action.trim() : ''
    const action = (ACTIONS.has(actionRaw as ReviewAction) ? actionRaw : 'Hold') as ReviewAction
    const rationale =
      typeof r.rationale === 'string' && r.rationale.trim()
        ? r.rationale.trim().slice(0, 600)
        : 'No rationale provided.'
    out.push({
      mint,
      symbol: (typeof r.symbol === 'string' && r.symbol) || known.get(mint) || mint.slice(0, 4),
      action,
      rationale,
    })
  }
  return out
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const { acquireProviderQuota } = await import('@/lib/providers/quota')
  const quota = await acquireProviderQuota('anthropic')
  if (quota.ok === false) {
    return NextResponse.json(
      {
        error: 'AI review temporarily rate-limited. Try again shortly.',
        reason: quota.reason,
        retryAfterMs: quota.retryAfterMs,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(quota.retryAfterMs / 1000)) },
      },
    )
  }

  let body: { walletAddress?: unknown }
  try {
    body = (await req.json()) as { walletAddress?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const walletAddress =
    typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
  if (!isValidSolanaWallet(walletAddress)) {
    return NextResponse.json({ error: 'walletAddress required' }, { status: 400 })
  }

  let analytics
  try {
    analytics = await buildPortfolioAnalytics(walletAddress)
  } catch (err) {
    console.error('[portfolio/review] analytics', err)
    return NextResponse.json({ error: 'Failed to build analytics context' }, { status: 502 })
  }

  const trending = await fetchTrending(5).catch(() => [])
  const known = new Map<string, string>(
    analytics.holdings.map((h) => [h.mint, h.symbol || h.mint.slice(0, 4)]),
  )

  const context = [
    `Wallet: ${analytics.walletAddress}`,
    `Total value USD: ${analytics.totalValueUsd.toFixed(2)}`,
    `Unrealized PnL: ${analytics.unrealizedPnl == null ? 'null (unavailable)' : analytics.unrealizedPnl.toFixed(2)}`,
    `Realized PnL: ${analytics.realizedPnl == null ? 'null (unavailable)' : analytics.realizedPnl.toFixed(2)}`,
    `Win rate: ${analytics.winRate == null ? 'null' : (analytics.winRate * 100).toFixed(1) + '%'}`,
    `Concentration (HHI): ${analytics.concentration.toFixed(4)}`,
    `Diversification (1-HHI): ${analytics.diversification.toFixed(4)}`,
    `Risk exposure: ${analytics.riskExposure == null ? 'null' : analytics.riskExposure}`,
    `Limitations: ${analytics.limitations ?? 'none'}`,
    'Holdings:',
    ...analytics.holdings.slice(0, 15).map((h) => {
      return `- mint=${h.mint} symbol=${h.symbol} valueUsd=${h.valueUsd.toFixed(2)} alloc=${h.allocationPct.toFixed(1)}% price=${h.priceUsd} avgEntry=${h.avgEntryPriceUsd ?? 'null'} unrealized=${h.unrealizedPnlUsd ?? 'null'} risk=${h.riskScore ?? 'null'}`
    }),
    'Trending (context only):',
    ...trending.slice(0, 5).map(
      (t) => `- ${t.symbol ?? t.mint} liq=${t.liquidityUsd} vol24h=${t.volume24hUsd} chg24h=${t.change24hPct}`,
    ),
  ].join('\n')

  const anthropic = createAnthropic({ apiKey: key })

  let rawText = ''
  let summary = ''
  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: [
        'You are CryptoCheck portfolio reviewer for Solana wallets.',
        'Return ONLY valid JSON matching:',
        '{"summary":string,"recommendations":[{"mint":string,"symbol":string,"action":"Hold"|"Buy"|"Reduce"|"Exit","rationale":string}]}',
        'One recommendation per holding mint provided. Cite concrete numbers from context.',
        'Never invent holdings, prices, or PnL that are null/missing — say data is unavailable.',
        'action must be exactly one of Hold, Buy, Reduce, Exit.',
      ].join(' '),
      prompt: `PORTFOLIO ANALYTICS:\n${context}\n\nProduce the JSON review now.`,
    })
    rawText = result.text
    try {
      const fence = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonText = fence?.[1]?.trim() ?? rawText
      const start = jsonText.indexOf('{')
      const end = jsonText.lastIndexOf('}')
      const obj = JSON.parse(jsonText.slice(start, end + 1)) as { summary?: string }
      if (typeof obj.summary === 'string') summary = obj.summary.trim().slice(0, 800)
    } catch {
      summary = ''
    }
  } catch (err) {
    console.error('[portfolio/review] anthropic', err)
    return NextResponse.json({ error: 'AI review failed' }, { status: 502 })
  }

  let recommendations = parseRecommendations(rawText, known)

  // Ensure every holding has a row — fill Hold with honest fallback if model omitted
  if (recommendations.length < analytics.holdings.length) {
    const have = new Set(recommendations.map((r) => r.mint))
    for (const h of analytics.holdings) {
      if (have.has(h.mint)) continue
      recommendations.push({
        mint: h.mint,
        symbol: h.symbol,
        action: 'Hold',
        rationale:
          h.avgEntryPriceUsd == null
            ? `No reliable cost basis for ${h.symbol}; allocation ${h.allocationPct.toFixed(1)}% of portfolio ($${h.valueUsd.toFixed(2)}). Insufficient data to recommend a change.`
            : `${h.symbol} is ${h.allocationPct.toFixed(1)}% of book at $${h.priceUsd} vs avg entry $${h.avgEntryPriceUsd.toFixed(6)}. Model omitted this mint — defaulting to Hold.`,
      })
    }
  }

  // Drop any hallucinated mints
  recommendations = recommendations.filter((r) => known.has(r.mint))

  if (!summary) {
    summary = `Reviewed ${recommendations.length} holding(s). Total value $${analytics.totalValueUsd.toFixed(2)}.`
  }

  const response: PortfolioReviewResponse = {
    walletAddress: analytics.walletAddress,
    recommendations,
    summary,
    disclaimer: DISCLAIMER,
    limitations: analytics.limitations,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(response)
}

export async function GET() {
  return NextResponse.json({
    available: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  })
}
