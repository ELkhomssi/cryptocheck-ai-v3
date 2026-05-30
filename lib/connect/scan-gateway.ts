import 'server-only'

import { NextRequest } from 'next/server'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { ANONYMOUS_PUBLIC_PRO_SCAN_USER_ID } from '@/lib/config/public-pro-scan'
import { canonicalScan } from '@/lib/sentinel/canonical-scan'
import { mergeReasoningWithCanonical } from '@/lib/sentinel/merge-canonical-institutional'
import {
  runInstitutionalScan,
  scanTokenIntelligence,
  type InstitutionalScanResult,
  type RunInstitutionalScanOptions,
  type ScanTokenIntelligenceInput,
  type ScanTokenIntelligenceResult,
} from '@/lib/services/scanner/execute-scan'
import { ScanServiceError, normalizeScanError } from '@/lib/services/scanner/ErrorHandler'
import { normalizeScanBody } from '@/lib/services/scanner/normalize-scan-body'
import { mapSnapshotToPlatformResponse } from '@/lib/services/scanner/map-platform-response'
import { buildSandboxSnapshot } from '@/lib/services/scanner/sandbox-snapshot'
import { maxBatchSizeForTier } from '@/lib/services/scanner/batch-limits'
import type { InstitutionalScanSnapshot, ScanExecutionMeta } from '@/lib/services/scanner/types'
import type { CanonicalScanResult } from '@/lib/types/canonical-scan'
import type { ScanV1ApiResponse } from '@/lib/types/institutional-scan-api'
import { chainRouter } from '@/lib/connect/chain-port'

export { ScanServiceError, normalizeScanBody, mapSnapshotToPlatformResponse, maxBatchSizeForTier }
export type { InstitutionalScanResult, RunInstitutionalScanOptions, ScanTokenIntelligenceResult }

/** Response header applied by all routes routed through the gateway. */
export const GATEWAY_ROUTE_HEADER = 'x-routed-via'
export const GATEWAY_ROUTE_VALUE = 'gateway'

export function gatewayResponseHeaders(extra?: Record<string, string>): Record<string, string> {
  return { [GATEWAY_ROUTE_HEADER]: GATEWAY_ROUTE_VALUE, ...extra }
}

export type GatewayScanEvent =
  | {
      type: 'scan.completed'
      mint: string
      verdict: string
      score: number
      userId: string
      cache: 'hit' | 'miss'
    }
  | {
      type: 'scan.failed'
      mint: string
      userId: string
      code: string
    }

type GatewayListener = (event: GatewayScanEvent) => void

const gatewayListeners: GatewayListener[] = []

/** Lightweight flywheel hook — subscribe from crons / internal jobs without importing scanner in routes. */
export const gatewayEventBus = {
  on(listener: GatewayListener): () => void {
    gatewayListeners.push(listener)
    return () => {
      const i = gatewayListeners.indexOf(listener)
      if (i >= 0) gatewayListeners.splice(i, 1)
    }
  },
  emit(event: GatewayScanEvent): void {
    for (const fn of gatewayListeners) {
      try {
        fn(event)
      } catch {
        /* listener errors must not break scan path */
      }
    }
  },
}

export type ScanViaGatewayOptions = RunInstitutionalScanOptions & {
  /** When true, skip ChainRouter pre-enrich (body already normalized + enriched). */
  skipChainEnrich?: boolean
}

/**
 * Sole supported in-process entry for institutional scans from API routes.
 * Delegates to `runInstitutionalScan` after optional ChainRouter enrichment.
 */
export async function scanViaGateway(
  req: NextRequest,
  ctx: ProFeatureContext,
  body: Record<string, unknown>,
  options?: ScanViaGatewayOptions
): Promise<InstitutionalScanResult> {
  const mintLabel = String(body.mint ?? body.tokenAddress ?? '').trim()
  let prepared = body

  if (options?.skipChainEnrich !== true) {
    try {
      prepared = await chainRouter.enrich(body)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Unsupported chain') || msg.includes('Invalid')) {
        return {
          ok: false,
          error: new ScanServiceError(msg, 'INVALID_INPUT', 400, undefined, 'INVALID_INPUT', 'medium'),
        }
      }
      /* enrichment best-effort — execute-scan re-enriches with cache */
      prepared = body
    }
  }

  const result = await runInstitutionalScan(req, ctx, prepared, options)

  if (result.ok) {
    gatewayEventBus.emit({
      type: 'scan.completed',
      mint: mintLabel,
      verdict: result.snapshot.reasoning.verdict,
      score: result.snapshot.reasoning.aggregateScore,
      userId: ctx.userId,
      cache: result.meta.cache,
    })
  } else if (result.ok === false) {
    gatewayEventBus.emit({
      type: 'scan.failed',
      mint: mintLabel,
      userId: ctx.userId,
      code: result.error.code,
    })
  }

  return result
}

export async function scanTokenIntelligenceViaGateway(
  input: ScanTokenIntelligenceInput
): Promise<ScanTokenIntelligenceResult> {
  return scanTokenIntelligence(input)
}

export async function buildSandboxSnapshotViaGateway(
  overrides: Record<string, unknown> = {}
): Promise<InstitutionalScanSnapshot> {
  const chainId = chainRouter.resolveChainId(overrides)
  const port = chainRouter.getPort(chainId)
  const mint = chainRouter.resolveMint(overrides)
  if (mint && !port.validateAddress(mint)) {
    throw new ScanServiceError('Invalid mint', 'INVALID_MINT_ADDRESS', 400)
  }
  return buildSandboxSnapshot(overrides)
}

export async function fetchCanonicalForMint(
  mint: string,
  opts?: { fastDepth?: boolean }
): Promise<CanonicalScanResult | undefined> {
  if (opts?.fastDepth || mint.length < 32) return undefined
  try {
    return await canonicalScan(mint)
  } catch {
    return undefined
  }
}

export function mergeSnapshotWithCanonical(
  snapshot: InstitutionalScanSnapshot,
  canonical: CanonicalScanResult
): InstitutionalScanSnapshot {
  return {
    ...snapshot,
    weighted: { ...snapshot.weighted, score: canonical.riskScore },
    reasoning: mergeReasoningWithCanonical(snapshot.reasoning, canonical),
  }
}

export function buildScanV1Payload(
  snapshot: InstitutionalScanSnapshot,
  meta: ScanExecutionMeta,
  requestId: string,
  canonical?: CanonicalScanResult
): ScanV1ApiResponse {
  const effective = canonical ? mergeSnapshotWithCanonical(snapshot, canonical) : snapshot

  return {
    score: effective.weighted.score,
    confidence: effective.weighted.confidence,
    risk_breakdown: effective.weighted.risk_breakdown,
    reasoning: effective.reasoning,
    wallet_reputation: effective.walletReputation,
    simulator: effective.simulator,
    rpc_provider: effective.rpcProviderLabel,
    pipeline_stages: effective.stages,
    pipeline_ms: effective.totalPipelineMs,
    last_updated: effective.updatedAt,
    cache: meta.cache,
    ...(canonical ? { canonical } : {}),
    meta: {
      response_time_ms: meta.responseTimeMs,
      auth_via: meta.authVia,
      user_id: meta.userId,
      request_id: requestId,
    },
  }
}

/** Risk-oriented view of a scan (higher score = riskier), for trading/payments callers. */
export type MintRiskAssessment = {
  /** 0–100 RISK score (higher = riskier) = 100 − safety. */
  riskScore: number
  /** 0–100 safety score (higher = safer) — the raw engine score. */
  safetyScore: number
  confidence: 'high' | 'medium' | 'low'
  verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED'
  enrichmentFailed: boolean
  snapshot: InstitutionalScanSnapshot
  cache: 'hit' | 'miss'
}

function riskVerdict(riskScore: number): MintRiskAssessment['verdict'] {
  if (riskScore >= 80) return 'BLOCKED'
  if (riskScore >= 60) return 'HIGH_RISK'
  if (riskScore >= 31) return 'CAUTION'
  return 'SAFE'
}

function confidenceBand(weightedConfidence: number, enrichmentFailed: boolean): 'high' | 'medium' | 'low' {
  if (enrichmentFailed) return 'low'
  if (weightedConfidence >= 0.75) return 'high'
  if (weightedConfidence >= 0.5) return 'medium'
  return 'low'
}

/**
 * Convenience entry for non-request callers (trading, payments, portfolio).
 * Runs a scan via the gateway with a synthetic request + anonymous context.
 * `depth: 'fast'` skips the canonical overlay for sub-200ms assessment.
 */
export async function assessRiskByMint(
  mint: string,
  chain: 'solana' | 'sol' = 'solana',
  depth: 'fast' | 'institutional' = 'fast'
): Promise<MintRiskAssessment> {
  const req = new NextRequest('http://internal.local/connect/assess-risk')
  const ctx: ProFeatureContext = {
    userId: ANONYMOUS_PUBLIC_PRO_SCAN_USER_ID,
    tier: 'free',
    via: 'session',
  }
  const body: Record<string, unknown> = { tokenAddress: mint, mint, chain }
  if (depth === 'fast') body.depth = 'fast'

  const normalized = normalizeScanBody(body)
  const result = await scanViaGateway(req, ctx, normalized, {
    suppressAudit: true,
    skipSessionRateLimit: true,
  })

  if (result.ok === false) throw result.error

  const safetyScore = Math.round(result.snapshot.weighted.score)
  const riskScore = Math.max(0, Math.min(100, 100 - safetyScore))
  const enrichmentFailed = result.meta.enrichmentFailed === true

  return {
    riskScore,
    safetyScore,
    confidence: confidenceBand(result.snapshot.weighted.confidence ?? 0, enrichmentFailed),
    verdict: riskVerdict(riskScore),
    enrichmentFailed,
    snapshot: result.snapshot,
    cache: result.meta.cache,
  }
}

export { normalizeScanError }
