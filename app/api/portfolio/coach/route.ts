import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { listAlerts } from '@/lib/portfolio-desk/alerts-store'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import type { CoachRequest } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/portfolio/coach — Claude portfolio coach (server-side only).
 * Streams via Vercel AI SDK. Never expose ANTHROPIC_API_KEY to the browser.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 503 },
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
      const alerts = listAlerts(10)
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

  const anthropic = createAnthropic({ apiKey: key })

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: [
      'You are CryptoCheck AI Coach — a portfolio-aware Solana trading coach.',
      'Cite specific numbers from the provided portfolio context when available.',
      'Never invent holdings, prices, or alerts that are not in the context.',
      'Always end with a one-line disclaimer that this is not financial advice.',
      'Be concise and actionable.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: `PORTFOLIO CONTEXT:\n${contextBlock}\n\nUSER MESSAGE:\n${message}`,
      },
    ],
  })

  return result.toTextStreamResponse()
}
