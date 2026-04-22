import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { mapWithConcurrency } from '@/lib/concurrency/pool'
import { resolveScanAuthOnly, scanClientIp, type ScanAccessContext } from '@/lib/auth/scan-access'
import { enforceDailyApiLimitCount } from '@/lib/services/api-daily-limit.service'
import { runInstitutionalScan } from '@/lib/services/scanner/execute-scan'
import { normalizeScanBody } from '@/lib/services/scanner/normalize-scan-body'
import { mapSnapshotToPlatformResponse } from '@/lib/services/scanner/map-platform-response'
import { logApiUsageEvent } from '@/lib/services/api-usage.service'
import { logSecurityEvent } from '@/lib/services/security-log.service'
import { ScanServiceError } from '@/lib/services/scanner/ErrorHandler'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import type { PlatformScanResponse } from '@/lib/types/platform-scan-api'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import { maxBatchSizeForTier } from '@/lib/services/scanner/batch-limits'
import { mergeWithRateLimitHeaders } from '@/lib/api/scan-api-errors'
import { securityLogUserIdForContext } from '@/lib/config/sentinel-qa-bypass'

export const dynamic = 'force-dynamic'

const BATCH_CONCURRENCY = 10

type ItemResult =
  | { index: number; ok: true; data: PlatformScanResponse }
  | { index: number; ok: false; error: string; code: number; reason?: string }

export async function POST(req: NextRequest) {
  const started = Date.now()
  const requestId = randomUUID()
  const priority = req.headers.get('x-cryptocheck-priority')?.toLowerCase() === 'high'

  const auth = await resolveScanAuthOnly(req)
  if (auth.ok === false) return auth.response
  const ctx: ScanAccessContext = auth.ctx

  const subscription = await getUserSubscription(ctx.userId)
  const sentinelTier = subscription.runtimeTier

  const body = (await req.json().catch(() => ({}))) as {
    items?: unknown[]
    chain?: string
    tokenAddresses?: string[]
    clientRef?: unknown
  }

  const headerRef = req.headers.get('x-cryptocheck-client-ref')?.trim() ?? ''
  const bodyRef = typeof body.clientRef === 'string' ? body.clientRef.trim() : ''
  const clientRef = (bodyRef || headerRef).slice(0, 80)

  let items: Record<string, unknown>[] = []
  if (Array.isArray(body.items)) {
    items = body.items as Record<string, unknown>[]
  } else if (Array.isArray(body.tokenAddresses)) {
    items = body.tokenAddresses.map((t) => ({ tokenAddress: t, chain: body.chain ?? 'solana' }))
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'Provide `items` (array of { tokenAddress, chain }) or `tokenAddresses`', code: 400, reason: 'INVALID_INPUT' },
      { status: 400 }
    )
  }

  const max = maxBatchSizeForTier(sentinelTier)
  if (items.length > max) {
    return NextResponse.json(
      {
        error: `Batch size exceeds plan maximum (${max})`,
        code: 400,
        reason: 'BATCH_LIMIT',
        limit: max,
      },
      { status: 400 }
    )
  }

  const dedupe = ctx.via === 'api_key' ? `apikey:${ctx.apiKeyId}` : `session:${ctx.userId}`
  const daily = await enforceDailyApiLimitCount(items.length, dedupe, sentinelTier)
  if (!daily.ok) {
    const retrySec = Math.max(1, Math.ceil((daily.reset - Date.now()) / 1000))
    return NextResponse.json(
      {
        error: 'Daily API quota exceeded for this batch',
        code: 429,
        reason: 'DAILY_QUOTA',
        limit: daily.limit,
        reset: daily.reset,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retrySec),
          ...mergeWithRateLimitHeaders({ limit: daily.limit, remaining: daily.remaining, reset: daily.reset }),
        },
      }
    )
  }

  const results = await mapWithConcurrency(items, BATCH_CONCURRENCY, async (item, index) => {
    const raw = { ...item, chain: (item.chain as string) ?? body.chain ?? 'solana' }
    const t0 = Date.now()
    let mintForLog = ''
    try {
      const normalized = normalizeScanBody(raw)
      mintForLog = String(normalized.mint ?? normalized.tokenAddress ?? '')
      const result = await runInstitutionalScan(req, ctx as ProFeatureContext, normalized, {
        suppressAudit: true,
      })
      if (result.ok === false) {
        const err = result.error
        void logSecurityEvent({
          userId: securityLogUserIdForContext(ctx),
          action: 'scan_item',
          resource: '/api/v1/scan/batch',
          ip: scanClientIp(req),
          userAgent: req.headers.get('user-agent'),
          metadata: {
            request_id: requestId,
            index,
            mint: mintForLog,
            ok: false,
            error: err.message,
            code: err.code,
            latency_ms: Date.now() - t0,
          },
        })
        return { index, ok: false as const, error: err.message, code: err.httpStatus, reason: err.code }
      }
      const { snapshot, meta } = result
      const platform = mapSnapshotToPlatformResponse(snapshot, {
        responseTimeMs: meta.responseTimeMs,
        cache: meta.cache,
        tier: sentinelTier,
        environment: 'live',
        requestId: `${requestId}:${index}`,
      })
      void logSecurityEvent({
        userId: securityLogUserIdForContext(ctx),
        action: 'scan_item',
        resource: '/api/v1/scan/batch',
        ip: scanClientIp(req),
        userAgent: req.headers.get('user-agent'),
        metadata: {
          request_id: requestId,
          index,
          mint: mintForLog,
          ok: true,
          score: platform.score,
          verdict: snapshot.reasoning.verdict,
          latency_ms: Date.now() - t0,
          cache: meta.cache,
        },
      })
      return { index, ok: true as const, data: platform }
    } catch (e) {
      const err = e instanceof ScanServiceError ? e : new ScanServiceError('Scan failed', 'UNKNOWN', 500)
      void logSecurityEvent({
        userId: securityLogUserIdForContext(ctx),
        action: 'scan_item',
        resource: '/api/v1/scan/batch',
        ip: scanClientIp(req),
        userAgent: req.headers.get('user-agent'),
        metadata: {
          request_id: requestId,
          index,
          mint: mintForLog,
          ok: false,
          error: err.message,
          code: err.code,
          latency_ms: Date.now() - t0,
        },
      })
      return { index, ok: false as const, error: err.message, code: err.httpStatus, reason: err.code }
    }
  })
  const okCount = results.filter((r) => r.ok).length

  await logApiUsageEvent({
    userId: securityLogUserIdForContext(ctx),
    apiKeyId: ctx.apiKeyId,
    endpoint: '/api/v1/scan/batch',
    method: 'POST',
    statusCode: 200,
    durationMs: Date.now() - started,
    ip: scanClientIp(req),
    userAgent: req.headers.get('user-agent'),
    priority,
    batchClientRef: clientRef || null,
  })

  return NextResponse.json(
    {
      request_id: requestId,
      batch_size: items.length,
      succeeded: okCount,
      failed: items.length - okCount,
      ...(clientRef ? { client_ref: clientRef } : {}),
      results,
    },
    {
      headers: mergeWithRateLimitHeaders(
        { limit: daily.limit, remaining: daily.remaining, reset: daily.reset },
        {
          'X-Request-Id': requestId,
          'X-Response-Time-Ms': String(Date.now() - started),
          'X-CryptoCheck-Sentinel-Tier': sentinelTier,
        }
      ),
    }
  )
}
