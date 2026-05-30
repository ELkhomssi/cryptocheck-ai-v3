import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { scanViaGateway, normalizeScanBody } from '@/lib/connect/scan-gateway'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { logApiUsageEvent } from '@/lib/services/api-usage.service'
import { resolvePartnerAuth } from '@/lib/b2b/partner-auth'
import {
  readReputation,
  riskScoreToVerdict,
  writeReputation,
  type ReputationSnapshot,
} from '@/lib/b2b/reputation-ledger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

function b2bHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'x-routed-via': 'gateway', 'x-ccai-surface': 'b2b', ...extra }
}

function toRiskScore(safetyScore: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - safetyScore)))
}

/**
 * GET /api/b2b/v1/reputation?chain=solana&address=<mint>
 * Returns the cached reputation snapshot; computes and caches one on miss.
 */
export async function GET(req: NextRequest) {
  const started = Date.now()
  const requestId = randomUUID()

  const auth = resolvePartnerAuth(req, '')
  if (auth.ok === false) {
    return NextResponse.json(
      { error: auth.message, code: auth.code },
      { status: auth.status, headers: b2bHeaders() }
    )
  }
  const partner = auth.partner

  const chainParam = req.nextUrl.searchParams.get('chain')?.trim().toLowerCase() || 'solana'
  const chain = chainParam === 'sol' ? 'solana' : chainParam
  const address = req.nextUrl.searchParams.get('address')?.trim() ?? ''

  if (!address) {
    return NextResponse.json(
      { error: 'Required query: chain, address', code: 'INVALID_INPUT' },
      { status: 400, headers: b2bHeaders() }
    )
  }

  let snapshot = await readReputation(chain, address)
  let enrichmentFailed = false

  if (!snapshot) {
    let normalized: Record<string, unknown>
    try {
      normalized = normalizeScanBody({ tokenAddress: address, mint: address, chain })
      normalized.depth = 'fast'
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid address', code: 'INVALID_INPUT' },
        { status: 400, headers: b2bHeaders() }
      )
    }

    const ctx: ProFeatureContext = {
      userId: partner.partnerId,
      tier: partner.tier,
      via: 'api_key',
    }
    const result = await scanViaGateway(req, ctx, normalized, {
      suppressAudit: true,
      skipSessionRateLimit: true,
    })

    if (result.ok === false) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: result.error.httpStatus, headers: b2bHeaders({ 'X-Request-Id': requestId }) }
      )
    }

    enrichmentFailed = result.meta.enrichmentFailed === true
    const riskScore = toRiskScore(result.snapshot.weighted.score)
    const fresh: ReputationSnapshot = {
      chain,
      address,
      riskScore,
      verdict: riskScoreToVerdict(riskScore),
      confidence: Math.round((result.snapshot.weighted.confidence ?? 0) * 100),
      topSignals: result.snapshot.reasoning.evidence
        .filter((e) => e.riskContribution > 0)
        .slice(0, 5)
        .map((e) => e.label),
      updatedAt: new Date().toISOString(),
      source: 'live',
    }
    void writeReputation(fresh)
    snapshot = fresh
  }

  const responseTimeMs = Date.now() - started

  await logApiUsageEvent({
    userId: null,
    endpoint: '/api/b2b/v1/reputation',
    method: 'GET',
    statusCode: 200,
    durationMs: responseTimeMs,
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(
    {
      request_id: requestId,
      chain: snapshot.chain,
      address: snapshot.address,
      score: snapshot.riskScore,
      verdict: snapshot.verdict,
      confidence: enrichmentFailed ? 'low' : snapshot.confidence,
      confidence_pct: snapshot.confidence,
      enrichment_failed: enrichmentFailed,
      top_signals: snapshot.topSignals,
      updated_at: snapshot.updatedAt,
      source: snapshot.source,
      partner_id: partner.partnerId,
    },
    {
      status: 200,
      headers: b2bHeaders({
        'X-Request-Id': requestId,
        'X-Response-Time-Ms': String(responseTimeMs),
        'X-Reputation-Source': snapshot.source,
      }),
    }
  )
}
