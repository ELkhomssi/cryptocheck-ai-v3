import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { scanClientIp } from '@/lib/auth/scan-access'
import { ANONYMOUS_PUBLIC_PRO_SCAN_USER_ID } from '@/lib/config/public-pro-scan'
import { mergeWithRateLimitHeaders, scanApiErrorPayload } from '@/lib/api/scan-api-errors'
import { enforcePublicProScanLimit } from '@/lib/rate-limit/public-pro-portal'
import {
  scanViaGateway,
  normalizeScanBody,
  ScanServiceError,
  gatewayResponseHeaders,
} from '@/lib/connect/scan-gateway'
import { scheduleCanonicalMerge } from '@/lib/connect/canonical-async'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { SentinelServerMisconfigurationError } from '@/lib/security/signing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Unauthenticated live scan for `/pro/dashboard` prospects.
 * IP rate limit: 5 requests / hour (Upstash sliding window when Redis is configured).
 */
export async function POST(req: NextRequest) {
  const started = Date.now()
  const requestId = randomUUID()
  console.log('[api/v1/scan/public] start', { requestId })
  const ip = scanClientIp(req) || 'unknown'
  const limit = await enforcePublicProScanLimit(ip)
  if (!limit.ok) {
    const retrySec = Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))
    return NextResponse.json(
      scanApiErrorPayload('Too many public scans from this network. Try again later.', 429, 'RATE_LIMIT', {
        reason: 'PUBLIC_RATE_LIMIT',
        severity: 'low',
      }),
      {
        status: 429,
        headers: gatewayResponseHeaders({
          'Retry-After': String(retrySec),
          ...mergeWithRateLimitHeaders({ limit: limit.limit, remaining: limit.remaining, reset: limit.reset }),
        }),
      }
    )
  }

  let rawBody: Record<string, unknown> = {}
  try {
    rawBody = (await req.json()) as Record<string, unknown>
  } catch {
    rawBody = {}
  }

  let body: Record<string, unknown>
  try {
    body = normalizeScanBody(rawBody)
  } catch (e) {
    const err = e instanceof ScanServiceError ? e : new ScanServiceError('Invalid request', 'INVALID_INPUT', 400)
    return NextResponse.json(err.toJSON(), { status: err.httpStatus, headers: gatewayResponseHeaders() })
  }

  const ctx: ProFeatureContext = {
    userId: ANONYMOUS_PUBLIC_PRO_SCAN_USER_ID,
    tier: 'free',
    via: 'session',
  }

  try {
    const result = await scanViaGateway(req, ctx, body, { skipSessionRateLimit: true, skipChainEnrich: true })
    if (result.ok === false) {
      const err = result.error
      if (err instanceof SentinelServerMisconfigurationError) {
        return NextResponse.json(err.toResponseBody(), { status: 500, headers: gatewayResponseHeaders() })
      }
      return NextResponse.json(err.toJSON(), { status: err.httpStatus, headers: gatewayResponseHeaders() })
    }

    const { snapshot, meta } = result
    const mint = String(body.mint ?? body.tokenAddress ?? '').trim()
    const fastDepth = body.depth === 'fast' || rawBody.depth === 'fast'
    const responseTimeMs = Date.now() - started

    if (!fastDepth && mint.length >= 32) {
      scheduleCanonicalMerge(mint, snapshot, body)
    }

    const payload = {
      score: snapshot.weighted.score,
      confidence: snapshot.weighted.confidence,
      risk_breakdown: snapshot.weighted.risk_breakdown,
      reasoning: snapshot.reasoning,
      wallet_reputation: snapshot.walletReputation,
      simulator: snapshot.simulator,
      rpc_provider: snapshot.rpcProviderLabel,
      pipeline_stages: snapshot.stages,
      pipeline_ms: snapshot.totalPipelineMs,
      last_updated: snapshot.updatedAt,
      cache: meta.cache,
      meta: {
        response_time_ms: responseTimeMs,
        auth_via: 'session' as const,
        user_id: 'public-demo',
        request_id: requestId,
      },
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: gatewayResponseHeaders({
        'X-Cache': meta.cache === 'hit' ? 'HIT' : 'MISS',
        'X-Cache-Hit': meta.cache === 'hit' ? 'true' : 'false',
        'X-Response-Time-Ms': String(responseTimeMs),
        'X-RPC-Provider': snapshot.rpcProviderLabel,
        'X-Request-Id': requestId,
        ...mergeWithRateLimitHeaders({ limit: limit.limit, remaining: limit.remaining, reset: limit.reset }),
      }),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Scan failed'
    console.error('[api/v1/scan/public] fail', { requestId, message: msg })
    return NextResponse.json(scanApiErrorPayload(msg, 500, 'INTERNAL', { reason: 'INTERNAL', severity: 'high' }), {
      status: 500,
      headers: gatewayResponseHeaders(),
    })
  }
}
