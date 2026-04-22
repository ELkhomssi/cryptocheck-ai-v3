import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withScanAccess, scanClientIp, type ScanAccessContext } from '@/lib/auth/scan-access'
import { runInstitutionalScan } from '@/lib/services/scanner/execute-scan'
import { normalizeScanBody } from '@/lib/services/scanner/normalize-scan-body'
import { mapSnapshotToPlatformResponse } from '@/lib/services/scanner/map-platform-response'
import { logApiUsageEvent } from '@/lib/services/api-usage.service'
import { ScanServiceError } from '@/lib/services/scanner/ErrorHandler'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { mergeWithRateLimitHeaders } from '@/lib/api/scan-api-errors'
import { securityLogUserIdForContext } from '@/lib/config/sentinel-qa-bypass'
import {
  assertEnterpriseIpAllowlist,
  assertScanSignature,
  assertScanTimestamp,
} from '@/lib/middleware/scan-v1-security'
import { SentinelServerMisconfigurationError } from '@/lib/security/signing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const PRIORITY_HEADER = 'high'

function inferResponseMode(body: Record<string, unknown>, req: NextRequest): 'full' | 'platform' {
  const raw = body.responseMode ?? body.format
  if (raw === 'platform' || raw === 'developer' || raw === 'compact') return 'platform'
  const accept = req.headers.get('accept') || ''
  if (accept.includes('application/vnd.cryptocheck.platform+json')) return 'platform'
  return 'full'
}

function jsonWithScanHeaders(
  ctx: ScanAccessContext,
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: mergeWithRateLimitHeaders(ctx.rateLimitDaily, extraHeaders),
  })
}

export const POST = withScanAccess(async (req: NextRequest, ctx: ScanAccessContext) => {
  const started = Date.now()
  const requestId = randomUUID()
  const priority = req.headers.get('x-cryptocheck-priority')?.toLowerCase() === PRIORITY_HEADER

  const rawText = await req.text()
  try {
    assertEnterpriseIpAllowlist(req, ctx)
    assertScanTimestamp(req, ctx)
    assertScanSignature(req, rawText, ctx)
  } catch (e) {
    if (e instanceof SentinelServerMisconfigurationError) {
      await logApiUsageEvent({
        userId: securityLogUserIdForContext(ctx),
        apiKeyId: ctx.apiKeyId,
        endpoint: '/api/v1/scan',
        method: 'POST',
        statusCode: 500,
        durationMs: Date.now() - started,
        ip: scanClientIp(req),
        userAgent: req.headers.get('user-agent'),
        priority,
      })
      return jsonWithScanHeaders(ctx, e.toResponseBody(), 500)
    }
    const err = e instanceof ScanServiceError ? e : new ScanServiceError('Invalid request', 'INVALID_INPUT', 400)
    await logApiUsageEvent({
      userId: securityLogUserIdForContext(ctx),
      apiKeyId: ctx.apiKeyId,
      endpoint: '/api/v1/scan',
      method: 'POST',
      statusCode: err.httpStatus,
      durationMs: Date.now() - started,
      ip: scanClientIp(req),
      userAgent: req.headers.get('user-agent'),
      priority,
    })
    return jsonWithScanHeaders(ctx, err.toJSON(), err.httpStatus)
  }

  let rawBody: Record<string, unknown> = {}
  try {
    rawBody = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
  } catch {
    rawBody = {}
  }

  let body: Record<string, unknown>
  try {
    body = normalizeScanBody(rawBody)
  } catch (e) {
    const err = e instanceof ScanServiceError ? e : new ScanServiceError('Invalid request', 'INVALID_INPUT', 400)
    await logApiUsageEvent({
      userId: securityLogUserIdForContext(ctx),
      apiKeyId: ctx.apiKeyId,
      endpoint: '/api/v1/scan',
      method: 'POST',
      statusCode: err.httpStatus,
      durationMs: Date.now() - started,
      ip: scanClientIp(req),
      userAgent: req.headers.get('user-agent'),
      priority,
    })
    return jsonWithScanHeaders(ctx, err.toJSON(), err.httpStatus)
  }

  const mode = inferResponseMode(rawBody, req)
  const result = await runInstitutionalScan(req, ctx as ProFeatureContext, body)

  if (result.ok === false) {
    const err = result.error
    await logApiUsageEvent({
      userId: securityLogUserIdForContext(ctx),
      apiKeyId: ctx.apiKeyId,
      endpoint: '/api/v1/scan',
      method: 'POST',
      statusCode: err.httpStatus,
      durationMs: Date.now() - started,
      ip: scanClientIp(req),
      userAgent: req.headers.get('user-agent'),
      priority,
    })
    return jsonWithScanHeaders(ctx, err.toJSON(), err.httpStatus)
  }

  const { snapshot, meta } = result
  const responseTimeMs = Date.now() - started

  await logApiUsageEvent({
    userId: securityLogUserIdForContext(ctx),
    apiKeyId: ctx.apiKeyId,
    endpoint: '/api/v1/scan',
    method: 'POST',
    statusCode: 200,
    durationMs: responseTimeMs,
    ip: scanClientIp(req),
    userAgent: req.headers.get('user-agent'),
    priority,
  })

  if (mode === 'platform') {
    const platform = mapSnapshotToPlatformResponse(snapshot, {
      responseTimeMs,
      cache: meta.cache,
      tier: ctx.tier,
      environment: 'live',
      requestId,
    })
    return jsonWithScanHeaders(ctx, platform, 200, {
      'X-Cache': meta.cache === 'hit' ? 'HIT' : 'MISS',
      'X-Cache-Hit': meta.cache === 'hit' ? 'true' : 'false',
      'X-Response-Time-Ms': String(responseTimeMs),
      'X-RPC-Provider': snapshot.rpcProviderLabel,
      'X-Request-Id': requestId,
      'X-RateLimit-Tier': ctx.tier,
    })
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
      response_time_ms: meta.responseTimeMs,
      auth_via: meta.authVia,
      user_id: meta.userId,
      request_id: requestId,
    },
  }

  return jsonWithScanHeaders(ctx, payload, 200, {
    'X-Cache': meta.cache === 'hit' ? 'HIT' : 'MISS',
    'X-Cache-Hit': meta.cache === 'hit' ? 'true' : 'false',
    'X-Response-Time-Ms': String(responseTimeMs),
    'X-RPC-Provider': snapshot.rpcProviderLabel,
    'X-Request-Id': requestId,
  })
})
