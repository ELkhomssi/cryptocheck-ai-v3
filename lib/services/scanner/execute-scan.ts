import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { fetchTokenMetrics, type TokenMetrics } from '@/lib/dexscreener/fetch-token-metrics'
import { getMintKeyedScanV2, setMintKeyedScanV2 } from '@/lib/cache/scan-cache'
import { buildTokenIntelligenceReport } from '@/lib/intelligence/fetch-token-intelligence'
import { enrichScanBodyFromChain } from '@/lib/services/scanner/solana-token-enrichment'
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
import { recordScanTiming } from '@/lib/telemetry/scan-timing'

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

function mergeDexLiquidityHint(prepared: Record<string, unknown>, dex: TokenMetrics | null): Record<string, unknown> {
  if (!dex?.liquidityUsd || !Number.isFinite(dex.liquidityUsd)) return prepared
  const cur = prepared.liquidityUsd
  if (cur != null && cur !== '') return prepared
  return { ...prepared, liquidityUsd: dex.liquidityUsd }
}

export type InstitutionalScanResult =
  | {
      ok: true
      snapshot: InstitutionalScanSnapshot
      meta: ScanExecutionMeta
    }
  | { ok: false; error: ScanServiceError }

export type RunInstitutionalScanOptions = {
  /** When true (e.g. batch inner items), skip `scan_v1` audit lines — caller logs `scan_item` per mint. */
  suppressAudit?: boolean
  /** Public marketing scans: do not apply per-session Redis scan throttle (IP limit enforced at route). */
  skipSessionRateLimit?: boolean
}

/**
 * Shared execution path for POST `/api/v1/scan` and `/api/v1/scan/reasoning` (same cache & audit semantics).
 */
export async function runInstitutionalScan(
  req: NextRequest,
  ctx: ProFeatureContext,
  body: Record<string, unknown>,
  options?: RunInstitutionalScanOptions
): Promise<InstitutionalScanResult> {
  const started = Date.now()
  const suppressAudit = options?.suppressAudit === true
  const mintEarly = String(body.mint ?? body.tokenAddress ?? '').trim()

  let enrichMs = 0
  let dexMs = 0
  const enrichPromise = (async () => {
    const s = Date.now()
    const out = await enrichScanBodyFromChain(body)
    enrichMs = Date.now() - s
    return out
  })()
  const dexPromise =
    mintEarly.length >= 32
      ? (async () => {
          const s = Date.now()
          try {
            const m = await fetchTokenMetrics(mintEarly)
            dexMs = Date.now() - s
            return m
          } catch {
            dexMs = Date.now() - s
            return null
          }
        })()
      : Promise.resolve(null)

  const [preparedRaw, dexMetrics] = await Promise.all([enrichPromise, dexPromise])
  let prepared = mergeDexLiquidityHint(preparedRaw, dexMetrics)
  const cacheKey = scanBodyCacheKey(prepared)
  const mintLabel = String(prepared.mint ?? body.mint ?? body.tokenAddress ?? '')

  /**
   * API-key requests are already tier-limited in `authenticateApiRequestOptional`.
   * Session-only Pro routes get an additional per-user scan limit here.
   */
  if (ctx.via === 'session' && options?.skipSessionRateLimit !== true) {
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

  const v2Cached =
    mintLabel.length >= 32 ? await getMintKeyedScanV2(mintLabel, cacheKey) : null
  if (v2Cached) {
    if (!suppressAudit) {
      void logSecurityEvent({
        userId: securityLogUserIdForContext(ctx),
        action: 'scan_v1',
        resource: '/api/v1/scan',
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent'),
        metadata: {
          mint: mintLabel,
          cache: 'hit',
          verdict: v2Cached.reasoning.verdict,
          score: v2Cached.reasoning.aggregateScore,
          authVia: ctx.via,
        },
      })
      recordScanTiming({
        mint: mintLabel,
        cached: true,
        heliusMs: enrichMs,
        dasMs: 0,
        dexMs,
        analyzeMs: 0,
        totalMs: Date.now() - started,
        userId: ctx.userId,
      })
    }
    return {
      ok: true,
      snapshot: v2Cached,
      meta: {
        cache: 'hit',
        responseTimeMs: Date.now() - started,
        userId: ctx.userId,
        authVia: ctx.via,
      },
    }
  }

  const cached = await getInstitutionalScan(cacheKey)
  if (cached) {
    if (!suppressAudit) {
      void logSecurityEvent({
        userId: securityLogUserIdForContext(ctx),
        action: 'scan_v1',
        resource: '/api/v1/scan',
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent'),
        metadata: {
          mint: mintLabel,
          cache: 'hit',
          verdict: cached.reasoning.verdict,
          score: cached.reasoning.aggregateScore,
          authVia: ctx.via,
        },
      })
      recordScanTiming({
        mint: mintLabel,
        cached: true,
        heliusMs: enrichMs,
        dasMs: 0,
        dexMs,
        analyzeMs: 0,
        totalMs: Date.now() - started,
        userId: ctx.userId,
      })
    }
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
    const analyzeStart = Date.now()
    const snapshot = await runInstitutionalPipeline(prepared)
    const analyzeMs = Date.now() - analyzeStart
    await setInstitutionalScan(cacheKey, snapshot)
    if (mintLabel.length >= 32) {
      void setMintKeyedScanV2(mintLabel, cacheKey, snapshot)
    }

    if (!suppressAudit) {
      void logSecurityEvent({
        userId: securityLogUserIdForContext(ctx),
        action: 'scan_v1',
        resource: '/api/v1/scan',
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent'),
        metadata: {
          mint: mintLabel,
          cache: 'miss',
          verdict: snapshot.reasoning.verdict,
          score: snapshot.reasoning.aggregateScore,
          rpcProvider: snapshot.rpcProviderLabel,
          authVia: ctx.via,
        },
      })

      void pushPulseEntry({
        mint: mintLabel,
        aggregateScore: snapshot.reasoning.aggregateScore,
        verdict: snapshot.reasoning.verdict,
        institutionalGrade: snapshot.reasoning.institutionalGrade,
        ts: new Date().toISOString(),
      })

      if (snapshot.reasoning.aggregateScore >= 85 && snapshot.reasoning.verdict === 'SAFE') {
        void WebhookService.dispatch(ctx.userId, 'high_safety_token', {
          mint: mintLabel,
          score: snapshot.reasoning.aggregateScore,
          grade: snapshot.reasoning.institutionalGrade,
        })
      }

      recordScanTiming({
        mint: mintLabel,
        cached: false,
        heliusMs: enrichMs,
        dasMs: 0,
        dexMs,
        analyzeMs,
        totalMs: Date.now() - started,
        userId: ctx.userId,
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
    if (!suppressAudit) {
      void logSecurityEvent({
        userId: securityLogUserIdForContext(ctx),
        action: 'scan_v1_error',
        resource: '/api/v1/scan',
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent'),
        metadata: { error: err.message, code: err.code },
      })
    }
    return { ok: false, error: err }
  }
}

export type ScanTokenIntelligenceInput = {
  mint: string
  mode?: 'full' | 'fast'
}

export type ScanTokenIntelligenceResult = {
  riskScore: number
  verdict: 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER'
  topSignals: string[]
}

/**
 * Lightweight wrapper for app routes that need a single-token risk snapshot.
 */
export async function scanTokenIntelligence(
  input: ScanTokenIntelligenceInput
): Promise<ScanTokenIntelligenceResult> {
  const mint = String(input.mint ?? '').trim()
  if (!mint) throw new Error('Mint is required')

  const report = await buildTokenIntelligenceReport({
    mint,
    keyTier: 'v2',
    publicTier: 'PRO',
    scanId: randomUUID(),
    onlyTicker: false,
  })

  const riskScore = typeof report.riskScore === 'number' ? report.riskScore : 50
  const verdict = (report.riskVerdict ?? 'CAUTION') as ScanTokenIntelligenceResult['verdict']
  const topSignals = Array.isArray(report.riskSignals)
    ? report.riskSignals.slice(0, 3).map((s) => s.message)
    : []

  return { riskScore, verdict, topSignals }
}
