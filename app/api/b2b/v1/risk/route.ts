import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { scanViaGateway, normalizeScanBody, ScanServiceError } from '@/lib/connect/scan-gateway'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { logApiUsageEvent } from '@/lib/services/api-usage.service'
import { resolvePartnerAuth } from '@/lib/b2b/partner-auth'
import { riskScoreToVerdict, writeReputation, readReputation, isReputationFresh } from '@/lib/b2b/reputation-ledger'
import { deliverPartnerWebhook } from '@/lib/b2b/webhook-delivery'
import { scheduleReputationRefresh } from '@/lib/b2b/reputation-refresh'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

function b2bHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'x-routed-via': 'gateway', 'x-ccai-surface': 'b2b', ...extra }
}

/** Safety (higher = safer) → risk (higher = riskier). */
function toRiskScore(safetyScore: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - safetyScore)))
}

/**
 * POST /api/b2b/v1/risk — partner risk assessment.
 * Auth: Bearer <partner_key> (+ X-CCAI-Partner-Secret or HMAC signature).
 * Body: { chain, address, mode?: 'fast' | 'institutional', webhookUrl? }
 */
export async function POST(req: NextRequest) {
  const started = Date.now()
  const requestId = randomUUID()
  const rawText = await req.text()

  const auth = resolvePartnerAuth(req, rawText)
  if (auth.ok === false) {
    return NextResponse.json(
      { error: auth.message, code: auth.code },
      { status: auth.status, headers: b2bHeaders() }
    )
  }
  const partner = auth.partner

  let raw: Record<string, unknown> = {}
  try {
    raw = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
  } catch {
    raw = {}
  }

  const chain = typeof raw.chain === 'string' ? raw.chain : 'solana'
  const address = typeof raw.address === 'string' ? raw.address.trim() : ''
  const mode = raw.mode === 'institutional' ? 'institutional' : 'fast'
  const webhookUrl = typeof raw.webhookUrl === 'string' ? raw.webhookUrl.trim() : ''

  if (!address) {
    return NextResponse.json(
      { error: 'Missing `address`', code: 'INVALID_INPUT' },
      { status: 400, headers: b2bHeaders() }
    )
  }

  let normalized: Record<string, unknown>
  try {
    normalized = normalizeScanBody({ tokenAddress: address, mint: address, chain })
    if (mode === 'fast') normalized.depth = 'fast'
  } catch (e) {
    const err = e instanceof ScanServiceError ? e : new ScanServiceError('Invalid request', 'INVALID_INPUT', 400)
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.httpStatus, headers: b2bHeaders() }
    )
  }

  const ctx: ProFeatureContext = {
    userId: partner.partnerId,
    tier: partner.tier,
    via: 'api_key',
  }

  const chainNorm = String(chain).toLowerCase() === 'sol' ? 'solana' : String(chain).toLowerCase()

  // A3 — read-first reputation for fast mode (<10ms when ledger is warm).
  if (mode === 'fast') {
    const ledgerHit = await readReputation(chainNorm, address)
    if (ledgerHit && isReputationFresh(ledgerHit)) {
      scheduleReputationRefresh(req, ctx, chainNorm, address)
      const responseTimeMs = Date.now() - started
      const confidence: 'low' | number =
        ledgerHit.confidence < 50 ? 'low' : ledgerHit.confidence

      await logApiUsageEvent({
        userId: null,
        endpoint: '/api/b2b/v1/risk',
        method: 'POST',
        statusCode: 200,
        durationMs: responseTimeMs,
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent'),
      })

      return NextResponse.json(
        {
          request_id: requestId,
          chain: chainNorm,
          address,
          mode,
          score: ledgerHit.riskScore,
          verdict: ledgerHit.verdict,
          confidence,
          confidence_pct: ledgerHit.confidence,
          enrichment_failed: false,
          top_signals: ledgerHit.topSignals,
          rpc_provider: 'reputation-ledger',
          cache: 'hit',
          source: 'reputation_ledger',
          response_time_ms: responseTimeMs,
          partner_id: partner.partnerId,
        },
        {
          status: 200,
          headers: b2bHeaders({
            'X-Request-Id': requestId,
            'X-Response-Time-Ms': String(responseTimeMs),
            'X-Cache': 'HIT',
            'X-Reputation-Source': 'ledger',
          }),
        }
      )
    }
  }

  // B2B billing is logged here; suppress internal scan audit to avoid FK to non-user partner ids.
  const result = await scanViaGateway(req, ctx, normalized, {
    suppressAudit: true,
    skipSessionRateLimit: true,
  })

  const responseTimeMs = Date.now() - started

  if (result.ok === false) {
    const err = result.error
    await logApiUsageEvent({
      userId: null,
      endpoint: '/api/b2b/v1/risk',
      method: 'POST',
      statusCode: err.httpStatus,
      durationMs: responseTimeMs,
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.httpStatus, headers: b2bHeaders({ 'X-Request-Id': requestId }) }
    )
  }

  const { snapshot, meta } = result
  const enrichmentFailed = meta.enrichmentFailed === true
  const riskScore = toRiskScore(snapshot.weighted.score)
  const verdict = riskScoreToVerdict(riskScore)
  const confidencePct = Math.round((snapshot.weighted.confidence ?? 0) * 100)
  /** Partner-facing band: degrades to 'low' when on-chain enrichment was unavailable. */
  const confidence: 'low' | number = enrichmentFailed ? 'low' : confidencePct
  const topSignals = snapshot.reasoning.evidence
    .filter((e) => e.riskContribution > 0)
    .slice(0, 5)
    .map((e) => e.label)

  const snapshotForLedger = {
    chain: String(chain).toLowerCase() === 'sol' ? 'solana' : String(chain).toLowerCase(),
    address,
    riskScore,
    verdict,
    confidence: confidencePct,
    topSignals,
    updatedAt: new Date().toISOString(),
    source: 'live' as const,
  }
  void writeReputation(snapshotForLedger)

  const payload = {
    request_id: requestId,
    chain: snapshotForLedger.chain,
    address,
    mode,
    score: riskScore,
    verdict,
    confidence,
    confidence_pct: confidencePct,
    enrichment_failed: enrichmentFailed,
    top_signals: topSignals,
    rpc_provider: snapshot.rpcProviderLabel,
    cache: meta.cache,
    response_time_ms: responseTimeMs,
    partner_id: partner.partnerId,
  }

  if (webhookUrl) {
    deliverPartnerWebhook(
      webhookUrl,
      { event: 'risk.assessed', partnerId: partner.partnerId, payload },
      process.env.B2B_TEST_SECRET?.trim()
    )
  }

  await logApiUsageEvent({
    userId: null,
    endpoint: '/api/b2b/v1/risk',
    method: 'POST',
    statusCode: 200,
    durationMs: responseTimeMs,
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(payload, {
    status: 200,
    headers: b2bHeaders({
      'X-Request-Id': requestId,
      'X-Response-Time-Ms': String(responseTimeMs),
      'X-Cache': meta.cache === 'hit' ? 'HIT' : 'MISS',
      ...(webhookUrl ? { 'X-Webhook-Queued': 'true' } : {}),
    }),
  })
}
