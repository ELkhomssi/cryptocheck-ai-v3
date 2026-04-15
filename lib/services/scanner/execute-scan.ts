import type { NextRequest } from 'next/server'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { runInstitutionalPipeline } from '@/lib/services/scanner/pipeline/run-institutional-scan'
import {
  getInstitutionalScan,
  setInstitutionalScan,
  scanBodyCacheKey,
} from '@/lib/services/scanner/ScannerCache'
import { pushPulseEntry } from '@/lib/services/pulse-feed.service'
import { WebhookService } from '@/lib/services/webhook.service'
import { securityLogUserIdForContext } from '@/lib/config/sentinel-qa-bypass'
import { logSecurityEvent } from '@/lib/services/security-log.service'
import { enforceRateLimit } from '@/lib/services/rate-limit.service'
import { normalizeScanError, ScanServiceError } from '@/lib/services/scanner/ErrorHandler'
import type { InstitutionalScanSnapshot, ScanExecutionMeta } from '@/lib/services/scanner/types'

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

export type InstitutionalScanResult =
  | {
      ok: true
      snapshot: InstitutionalScanSnapshot
      meta: ScanExecutionMeta
    }
  | { ok: false; error: ScanServiceError }

/**
 * Shared execution path for POST `/api/v1/scan` and `/api/v1/scan/reasoning` (same cache & audit semantics).
 */
export async function runInstitutionalScan(
  req: NextRequest,
  ctx: ProFeatureContext,
  body: Record<string, unknown>
): Promise<InstitutionalScanResult> {
  const started = Date.now()
  const cacheKey = scanBodyCacheKey(body)

  /**
   * API-key requests are already tier-limited in `authenticateApiRequestOptional`.
   * Session-only Pro routes get an additional per-user scan limit here.
   */
  if (ctx.via === 'session') {
    try {
      const rate = await enforceRateLimit(`session:${ctx.userId}`, ctx.tier)
      if (!rate.ok) {
        return {
          ok: false,
          error: new ScanServiceError(
            'Rate limit exceeded',
            'RATE_LIMIT',
            429,
            undefined,
            'RATE_LIMIT',
            'medium'
          ),
        }
      }
    } catch {
      /* best-effort — if Redis unavailable, allow */
    }
  }

  const cached = await getInstitutionalScan(cacheKey)
  if (cached) {
    void logSecurityEvent({
      userId: securityLogUserIdForContext(ctx),
      action: 'scan_v1',
      resource: '/api/v1/scan',
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: {
        mint: body.mint,
        cache: 'hit',
        verdict: cached.reasoning.verdict,
        score: cached.reasoning.aggregateScore,
        authVia: ctx.via,
      },
    })
    return {
      ok: true,
      snapshot: cached,
      meta: {
        cache: 'hit',
        responseTimeMs: Date.now() - started,
        userId: ctx.userId,
        authVia: ctx.via,
      },
    }
  }

  try {
    const snapshot = await runInstitutionalPipeline(body)
    await setInstitutionalScan(cacheKey, snapshot)

    void logSecurityEvent({
      userId: securityLogUserIdForContext(ctx),
      action: 'scan_v1',
      resource: '/api/v1/scan',
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: {
        mint: body.mint,
        cache: 'miss',
        verdict: snapshot.reasoning.verdict,
        score: snapshot.reasoning.aggregateScore,
        rpcProvider: snapshot.rpcProviderLabel,
        authVia: ctx.via,
      },
    })

    void pushPulseEntry({
      mint: String(body.mint ?? ''),
      aggregateScore: snapshot.reasoning.aggregateScore,
      verdict: snapshot.reasoning.verdict,
      institutionalGrade: snapshot.reasoning.institutionalGrade,
      ts: new Date().toISOString(),
    })

    if (snapshot.reasoning.aggregateScore >= 85 && snapshot.reasoning.verdict === 'SAFE') {
      void WebhookService.dispatch(ctx.userId, 'high_safety_token', {
        mint: String(body.mint ?? ''),
        score: snapshot.reasoning.aggregateScore,
        grade: snapshot.reasoning.institutionalGrade,
      })
    }

    return {
      ok: true,
      snapshot,
      meta: {
        cache: 'miss',
        responseTimeMs: Date.now() - started,
        userId: ctx.userId,
        authVia: ctx.via,
      },
    }
  } catch (e) {
    const err = e instanceof ScanServiceError ? e : normalizeScanError(e)
    void logSecurityEvent({
      userId: securityLogUserIdForContext(ctx),
      action: 'scan_v1_error',
      resource: '/api/v1/scan',
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: { error: err.message, code: err.code },
    })
    return { ok: false, error: err }
  }
}
