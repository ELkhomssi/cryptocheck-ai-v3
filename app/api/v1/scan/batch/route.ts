import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { resolveScanAuthOnly, scanClientIp, type ScanAccessContext } from '@/lib/auth/scan-access'
import { enforceDailyApiLimitCount } from '@/lib/services/api-daily-limit.service'
import { runInstitutionalScan } from '@/lib/services/scanner/execute-scan'
import { normalizeScanBody } from '@/lib/services/scanner/normalize-scan-body'
import { mapSnapshotToPlatformResponse } from '@/lib/services/scanner/map-platform-response'
import { logApiUsageEvent } from '@/lib/services/api-usage.service'
import { ScanServiceError } from '@/lib/services/scanner/ErrorHandler'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import type { PlatformScanResponse } from '@/lib/types/platform-scan-api'
import type { SubscriptionTier } from '@/lib/types/tier'

export const dynamic = 'force-dynamic'

function maxBatchForTier(tier: SubscriptionTier): number {
  if (tier === 'institutional') return 100
  if (tier === 'pro') return 20
  return 5
}

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

  const body = (await req.json().catch(() => ({}))) as {
    items?: unknown[]
    chain?: string
    tokenAddresses?: string[]
  }

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

  const max = maxBatchForTier(ctx.tier)
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
  const daily = await enforceDailyApiLimitCount(items.length, dedupe, ctx.tier)
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
        headers: { 'Retry-After': String(retrySec) },
      }
    )
  }

  const results: ItemResult[] = []
  let okCount = 0

  for (let index = 0; index < items.length; index++) {
    const raw = { ...items[index], chain: (items[index].chain as string) ?? body.chain ?? 'solana' }
    try {
      const normalized = normalizeScanBody(raw)
      const result = await runInstitutionalScan(req, ctx as ProFeatureContext, normalized)
      if (result.ok === false) {
        const err = result.error
        results.push({ index, ok: false, error: err.message, code: err.httpStatus, reason: err.code })
        continue
      }
      const { snapshot, meta } = result
      const platform = mapSnapshotToPlatformResponse(snapshot, {
        responseTimeMs: meta.responseTimeMs,
        cache: meta.cache,
        tier: ctx.tier,
        environment: 'live',
        requestId: `${requestId}:${index}`,
      })
      results.push({ index, ok: true, data: platform })
      okCount++
    } catch (e) {
      const err = e instanceof ScanServiceError ? e : new ScanServiceError('Scan failed', 'UNKNOWN', 500)
      results.push({ index, ok: false, error: err.message, code: err.httpStatus, reason: err.code })
    }
  }

  await logApiUsageEvent({
    userId: ctx.userId,
    apiKeyId: ctx.apiKeyId,
    endpoint: '/api/v1/scan/batch',
    method: 'POST',
    statusCode: 200,
    durationMs: Date.now() - started,
    ip: scanClientIp(req),
    userAgent: req.headers.get('user-agent'),
    priority,
  })

  return NextResponse.json(
    {
      request_id: requestId,
      batch_size: items.length,
      succeeded: okCount,
      failed: items.length - okCount,
      results,
    },
    {
      headers: {
        'X-Request-Id': requestId,
        'X-Response-Time-Ms': String(Date.now() - started),
      },
    }
  )
}
