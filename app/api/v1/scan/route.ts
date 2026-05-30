import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withScanAccess, scanClientIp, type ScanAccessContext } from '@/lib/auth/scan-access'
import {
  scanViaGateway,
  normalizeScanBody,
  mapSnapshotToPlatformResponse,
  ScanServiceError,
  buildScanV1Payload,
  gatewayResponseHeaders,
} from '@/lib/connect/scan-gateway'
import { scheduleCanonicalMerge } from '@/lib/connect/canonical-async'
import { logApiUsageEvent } from '@/lib/services/api-usage.service'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { mergeWithRateLimitHeaders } from '@/lib/api/scan-api-errors'
import { securityLogUserIdForContext } from '@/lib/config/sentinel-qa-bypass'
import {
  assertEnterpriseIpAllowlist,
  assertScanSignature,
  assertScanTimestamp,
} from '@/lib/middleware/scan-v1-security'
import { SentinelServerMisconfigurationError } from '@/lib/security/signing'
import { ANONYMOUS_PUBLIC_PRO_SCAN_USER_ID } from '@/lib/config/public-pro-scan'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const PRIORITY_HEADER = 'high'

/**
 * Internal fast scan — GET `/api/v1/scan?depth=fast&mint=<base58>`
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (server components, crons).
 */
export async function GET(req: NextRequest) {
  const depth = req.nextUrl.searchParams.get('depth')
  const mint = req.nextUrl.searchParams.get('mint')?.trim() ?? ''
  if (depth !== 'fast' || mint.length < 32) {
    return NextResponse.json(
      { error: 'Required query: depth=fast&mint=<solana_mint>' },
      { status: 400, headers: gatewayResponseHeaders() }
    )
  }

  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const requestId = randomUUID()
  const ctx: ProFeatureContext = {
    userId: ANONYMOUS_PUBLIC_PRO_SCAN_USER_ID,
    tier: 'free',
    via: 'session',
  }
  const body = { mint, tokenAddress: mint, depth: 'fast' }

  let normalized: Record<string, unknown>
  try {
    normalized = normalizeScanBody(body)
  } catch (e) {
    const err = e instanceof ScanServiceError ? e : new ScanServiceError('Invalid request', 'INVALID_INPUT', 400)
    return NextResponse.json(err.toJSON(), { status: err.httpStatus, headers: gatewayResponseHeaders() })
  }

  const result = await scanViaGateway(req, ctx, normalized, {
    suppressAudit: true,
    skipSessionRateLimit: true,
    skipChainEnrich: true,
  })

  if (result.ok === false) {
    const err = result.error
    return NextResponse.json(err.toJSON(), { status: err.httpStatus, headers: gatewayResponseHeaders() })
  }

  const payload = buildScanV1Payload(result.snapshot, result.meta, requestId)
  const responseTimeMs = Date.now() - started

  return NextResponse.json(payload, {
    status: 200,
    headers: gatewayResponseHeaders({
      'X-Cache': result.meta.cache === 'hit' ? 'HIT' : 'MISS',
      'X-Cache-Hit': result.meta.cache === 'hit' ? 'true' : 'false',
      'X-Response-Time-Ms': String(responseTimeMs),
      'X-RPC-Provider': result.snapshot.rpcProviderLabel,
      'X-Request-Id': requestId,
      'X-Scan-Depth': 'fast',
    }),
  })
}

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
    headers: mergeWithRateLimitHeaders(ctx.rateLimitDaily, gatewayResponseHeaders(extraHeaders)),
  })
}

export const POST = withScanAccess(async (req: NextRequest, ctx: ScanAccessContext) => {
  const started = Date.now()
  const requestId = randomUUID()
  console.log('[api/v1/scan] start', { requestId, tier: ctx.tier, via: ctx.via })
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
  const result = await scanViaGateway(req, ctx as ProFeatureContext, body, { skipChainEnrich: true })

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
  const mint = String(body.mint ?? '').trim()
  const fastDepth = body.depth === 'fast' || req.nextUrl.searchParams.get('depth') === 'fast'

  // I7 — canonical overlay runs async; never blocks response (full scans merge into cache for next hit).
  let canonicalPending = false
  if (!fastDepth && mint.length >= 32) {
    scheduleCanonicalMerge(mint, snapshot, body)
    canonicalPending = true
  }

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

  const effectiveSnapshot = snapshot

  if (mode === 'platform') {
    const platform = mapSnapshotToPlatformResponse(effectiveSnapshot, {
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
      ...(fastDepth ? { 'X-Scan-Depth': 'fast' } : {}),
      ...(canonicalPending ? { 'X-Canonical-Pending': 'true' } : {}),
    })
  }

  const payload = buildScanV1Payload(effectiveSnapshot, meta, requestId)

  return jsonWithScanHeaders(ctx, payload, 200, {
    'X-Cache': meta.cache === 'hit' ? 'HIT' : 'MISS',
    'X-Cache-Hit': meta.cache === 'hit' ? 'true' : 'false',
    'X-Response-Time-Ms': String(responseTimeMs),
    'X-RPC-Provider': snapshot.rpcProviderLabel,
    'X-Request-Id': requestId,
    ...(fastDepth ? { 'X-Scan-Depth': 'fast' } : {}),
    ...(canonicalPending ? { 'X-Canonical-Pending': 'true' } : {}),
  })
})
