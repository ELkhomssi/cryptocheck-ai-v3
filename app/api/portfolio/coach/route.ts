import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { AGENT_OPENAI_MODEL, getOpenAiApiKey, isOpenAiConfigured } from '@/lib/agents/llm'
import { listAlerts } from '@/lib/portfolio-desk/alerts-store'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { fetchTokenMarket, fetchTrending } from '@/lib/providers/birdeye'
import {
  computeAiScore,
  computeRiskScore,
  computeSmartMoneyScore,
} from '@/lib/terminal/scoring'
import type { CoachRequest } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Solana base58 mint / pubkey (32–44 chars). */
const BASE58_MINT_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g

function extractMints(message: string): string[] {
  const hits = message.match(BASE58_MINT_RE) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of hits) {
    if (seen.has(m)) continue
    seen.add(m)
    out.push(m)
    if (out.length >= 3) break
  }
  return out
}

async function buildMarketGrounding(message: string): Promise<string> {
  const blocks: string[] = []

  try {
    // ~80–200ms estimated (Birdeye trending, cached)
    const trending = await fetchTrending(5)
    if (trending.length) {
      blocks.push(
        'Screener trending (top 5):',
        ...trending.map(
          (t, i) =>
            `${i + 1}. ${t.symbol || '?'} (${t.mint}) price=${t.priceUsd} liq=${t.liquidityUsd} vol24h=${t.volume24hUsd} chg24h=${t.change24hPct}% risk=${computeRiskScore(t)} ai=${computeAiScore(t)} smart=${computeSmartMoneyScore(t)}`,
        ),
      )
    } else {
      blocks.push('Screener trending: unavailable (Birdeye key missing or empty).')
    }
  } catch {
    blocks.push('Screener trending: fetch failed.')
  }

  const mints = extractMints(message)
  if (mints.length) {
    const mintLines: string[] = ['Mentioned mint market data:']
    for (const mint of mints) {
      try {
        // ~50–150ms estimated per mint (Birdeye overview + local scores)
        const m = await fetchTokenMarket(mint)
        if (!m) {
          mintLines.push(`- ${mint}: market data unavailable`)
          continue
        }
        mintLines.push(
          `- ${m.symbol || '?'} (${mint}): price=${m.priceUsd} liq=${m.liquidityUsd} vol24h=${m.volume24hUsd} mcap=${m.marketCapUsd} holders=${m.holders} chg24h=${m.change24hPct}% riskScore=${computeRiskScore(m)} aiScore=${computeAiScore(m)} smartMoneyScore=${computeSmartMoneyScore(m)}`,
        )
      } catch {
        mintLines.push(`- ${mint}: market fetch failed`)
      }
    }
    blocks.push(mintLines.join('\n'))
  }

  return blocks.join('\n')
}

/**
 * GET /api/portfolio/coach — availability probe (no secrets leaked).
 */
export async function GET() {
  return NextResponse.json({
    available: isOpenAiConfigured(),
  })
}

/**
 * POST /api/portfolio/coach — OpenAI portfolio coach (server-side only).
 * Streams via Vercel AI SDK. Never expose OPENAI_API_KEY to the browser.
 * Grounds replies on holdings, alerts, Birdeye trending, and any mint in the message.
 */
export async function POST(req: NextRequest) {
  const key = getOpenAiApiKey()
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const { acquireProviderQuota } = await import('@/lib/providers/quota')
  const quota = await acquireProviderQuota('openai')
  if (quota.ok === false) {
    return NextResponse.json(
      {
        error: 'AI Coach temporarily rate-limited. Try again shortly.',
        reason: quota.reason,
        retryAfterMs: quota.retryAfterMs,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(quota.retryAfterMs / 1000)) },
      },
    )
  }

  let body: CoachRequest
  try {
    body = (await req.json()) as CoachRequest
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const message = body.message?.trim()
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  let contextBlock = 'No wallet connected — answer generally and ask the user to connect.'
  if (body.walletAddress && body.walletAddress.length >= 32) {
    try {
      const holdings = await buildHoldingsResponse(body.walletAddress)
      const alerts = await listAlerts(10)
      contextBlock = [
        `Wallet: ${holdings.walletAddress}`,
        `Total value USD: ${holdings.totalValueUsd.toFixed(2)}`,
        `Holdings (${holdings.holdings.length}):`,
        ...holdings.holdings.slice(0, 15).map(
          (h) =>
            `- ${h.symbol} (${h.name}): amount=${h.amount} valueUsd=${h.valueUsd.toFixed(2)} price=${h.priceUsd} alloc=${h.allocationPct.toFixed(1)}%`,
        ),
        `Recent alerts (${alerts.length}):`,
        ...alerts.slice(0, 8).map((a) => `- [${a.type}] ${a.title}: ${a.description}`),
      ].join('\n')
    } catch {
      contextBlock = 'Wallet provided but holdings fetch failed — say so honestly.'
    }
  }

  const marketBlock = await buildMarketGrounding(message)

  const openai = createOpenAI({ apiKey: key })

  const result = streamText({
    model: openai(AGENT_OPENAI_MODEL),
    system: [
      'You are CryptoCheck AI Coach — a portfolio-aware Solana trading coach.',
      'Cite specific numbers from the provided portfolio and market context when available.',
      'Never invent holdings, prices, trending tokens, or alerts that are not in the context.',
      'When mint market lines are present, use those risk/ai/smartMoney scores.',
      'Always end with a one-line disclaimer that this is not financial advice.',
      'Be concise and actionable.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: `PORTFOLIO CONTEXT:\n${contextBlock}\n\nMARKET CONTEXT:\n${marketBlock}\n\nUSER MESSAGE:\n${message}`,
      },
    ],
  })

  return result.toTextStreamResponse()
}
