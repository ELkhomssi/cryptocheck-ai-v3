import { NextRequest, NextResponse } from 'next/server'
import { withProFeature } from '@/lib/auth/pro-feature-access'
import { ScannerEngine, type ScannerEngineInput } from '@/lib/services/scanner-engine'
import { getCachedReasoning, reasoningCacheKey, setCachedReasoning } from '@/lib/services/reasoning-cache'
import { pushPulseEntry } from '@/lib/services/pulse-feed.service'
import { WebhookService } from '@/lib/services/webhook.service'

export const dynamic = 'force-dynamic'

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function boolOrNull(v: unknown): boolean | null {
  if (v === true || v === false) return v
  return null
}

function buildInput(body: Record<string, unknown>): ScannerEngineInput {
  return {
    mint: String(body.mint ?? '').trim(),
    liquidityUsd: numOrNull(body.liquidityUsd),
    topHolderPct: numOrNull(body.topHolderPct),
    pairAgeMinutes: numOrNull(body.pairAgeMinutes),
    mintAuthorityActive: boolOrNull(body.mintAuthorityActive),
    creatorWallet: typeof body.creatorWallet === 'string' ? body.creatorWallet : null,
    creatorScamLinkedFundingCount: Number(body.creatorScamLinkedFundingCount ?? 0) || 0,
    signals: (body.signals as ScannerEngineInput['signals']) ?? {},
    swapQuoteExpectedOut: numOrNull(body.swapQuoteExpectedOut),
    swapQuoteActualOut: numOrNull(body.swapQuoteActualOut),
  }
}

function hasDynamicLayer(body: Record<string, unknown>): boolean {
  const b64 = body.serializedSwapTransactionBase64
  if (typeof b64 === 'string' && b64.length > 0) return true
  if (body.swapQuoteExpectedOut != null || body.swapQuoteActualOut != null) return true
  return false
}

/**
 * Pro-only: explainable reasoning + 60s Redis cache + Pulse + optional webhooks.
 */
export const POST = withProFeature(async (req: NextRequest, ctx) => {
  const started = Date.now()
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = buildInput(body)
    if (!input.mint || input.mint.length < 32) {
      return NextResponse.json({ error: 'Invalid mint' }, { status: 400 })
    }

    const cacheKey = reasoningCacheKey(body)
    const cached = await getCachedReasoning(cacheKey)
    if (cached) {
      return NextResponse.json(
        { reasoning: cached, cache: 'hit' },
        {
          headers: {
            'X-Cache': 'HIT',
            'X-Response-Time-Ms': String(Date.now() - started),
          },
        }
      )
    }

    const serialized =
      typeof body.serializedSwapTransactionBase64 === 'string'
        ? body.serializedSwapTransactionBase64
        : undefined

    let reasoning
    if (hasDynamicLayer(body)) {
      reasoning = await ScannerEngine.analyzeWithDynamicSimulation(input, {
        serializedSwapTransactionBase64: serialized,
      })
    } else {
      reasoning = ScannerEngine.analyze(input)
    }

    await setCachedReasoning(cacheKey, reasoning)

    void pushPulseEntry({
      mint: input.mint,
      aggregateScore: reasoning.aggregateScore,
      verdict: reasoning.verdict,
      institutionalGrade: reasoning.institutionalGrade,
      ts: new Date().toISOString(),
    })

    if (reasoning.aggregateScore >= 85 && reasoning.verdict === 'SAFE') {
      void WebhookService.dispatch(ctx.userId, 'high_safety_token', {
        mint: input.mint,
        score: reasoning.aggregateScore,
        grade: reasoning.institutionalGrade,
      })
    }

    return NextResponse.json(
      { reasoning, cache: 'miss' },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-Response-Time-Ms': String(Date.now() - started),
        },
      }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})
