import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withScanAccess, scanClientIp, type ScanAccessContext } from '@/lib/auth/scan-access'
import {
  normalizeScanBody,
  mapSnapshotToPlatformResponse,
  ScanServiceError,
  buildSandboxSnapshotViaGateway,
  gatewayResponseHeaders,
} from '@/lib/connect/scan-gateway'
import { logApiUsageEvent } from '@/lib/services/api-usage.service'
import { mergeWithRateLimitHeaders } from '@/lib/api/scan-api-errors'
import { securityLogUserIdForContext } from '@/lib/config/sentinel-qa-bypass'

export const dynamic = 'force-dynamic'

/**
 * Sandbox scan — same scoring engine path without serialized on-chain swap / simulateTransaction.
 * Response is always the compact **platform** JSON contract.
 */
export const POST = withScanAccess(async (req: NextRequest, ctx: ScanAccessContext) => {
  const started = Date.now()
  const requestId = randomUUID()
  const priority = req.headers.get('x-cryptocheck-priority')?.toLowerCase() === 'high'

  let rawBody: Record<string, unknown> = {}
  try {
    rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>
  } catch {
    rawBody = {}
  }

  let overrides: Record<string, unknown> = {}
  try {
    if (rawBody.tokenAddress || rawBody.mint) {
      overrides = normalizeScanBody(rawBody)
    }
  } catch (e) {
    const err = e instanceof ScanServiceError ? e : new ScanServiceError('Invalid request', 'INVALID_INPUT', 400)
    await logApiUsageEvent({
      userId: securityLogUserIdForContext(ctx),
      apiKeyId: ctx.apiKeyId,
      endpoint: '/api/v1/scan/sandbox',
      method: 'POST',
      statusCode: err.httpStatus,
      durationMs: Date.now() - started,
      ip: scanClientIp(req),
      userAgent: req.headers.get('user-agent'),
      priority,
    })
    return NextResponse.json(err.toJSON(), {
      status: err.httpStatus,
      headers: mergeWithRateLimitHeaders(ctx.rateLimitDaily, gatewayResponseHeaders()),
    })
  }

  const snapshot = await buildSandboxSnapshotViaGateway(overrides)
  const responseTimeMs = Date.now() - started

  await logApiUsageEvent({
    userId: securityLogUserIdForContext(ctx),
    apiKeyId: ctx.apiKeyId,
    endpoint: '/api/v1/scan/sandbox',
    method: 'POST',
    statusCode: 200,
    durationMs: responseTimeMs,
    ip: scanClientIp(req),
    userAgent: req.headers.get('user-agent'),
    priority,
  })

  const platform = mapSnapshotToPlatformResponse(snapshot, {
    responseTimeMs,
    cache: 'miss',
    tier: ctx.tier,
    environment: 'sandbox',
    requestId,
  })

  return NextResponse.json(platform, {
    headers: mergeWithRateLimitHeaders(ctx.rateLimitDaily, gatewayResponseHeaders({
      'X-Environment': 'sandbox',
      'X-Response-Time-Ms': String(responseTimeMs),
      'X-Request-Id': requestId,
    })),
  })
})
