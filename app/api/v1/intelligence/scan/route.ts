import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitHeaderTriple, scanApiErrorPayload } from '@/lib/api/scan-api-errors'
import { intelCacheGetJson, intelCacheSetJson } from '@/lib/cache/intel-cache'
import { extractRawApiKey } from '@/lib/middleware/with-api-auth'
import { userEntitledForProductAccess } from '@/lib/services/saas-entitlement.service'
import { verifyApiKey, touchVerifiedApiKeyLastUsed } from '@/lib/services/api-key.service'
import { enforceRateLimit } from '@/lib/services/rate-limit.service'
import { subscriptionService } from '@/lib/services/subscription.service'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildTokenIntelligenceReport, TokenNotFoundError } from '@/lib/intelligence/fetch-token-intelligence'
import { subscriptionTierToPublic } from '@/lib/types/intelligence'
import type { TokenIntelligenceReport } from '@/lib/types/intelligence'
import type { SubscriptionTier } from '@/lib/types/tier'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'

function withApproxCacheAge(report: TokenIntelligenceReport, ttlSec: number): TokenIntelligenceReport {
  return {
    ...report,
    meta: {
      ...report.meta,
      cacheAge: Math.floor(ttlSec / 2),
    },
  }
}

async function insertScanHistoryFireAndForget(input: {
  userId: string
  mint: string
  riskScore: number | null
  verdict: string | null
  scanId: string
}): Promise<void> {
  try {
    const sb = getSupabaseAdmin()
    const { error } = await sb.from('scan_history').insert({
      user_id: input.userId,
      mint_address: input.mint,
      risk_score: input.riskScore,
      verdict: input.verdict,
      scan_id: input.scanId,
    })
    if (error) throw error
  } catch (e) {
    console.error('[intelligence/scan] scan_history insert failed', e)
  }
}

export async function POST(req: NextRequest) {
  const raw = extractRawApiKey(req)
  if (!raw) {
    return NextResponse.json(
      scanApiErrorPayload('Missing API key', 401, 'MISSING_API_KEY', {
        reason: 'MISSING_API_KEY',
        severity: 'medium',
      }),
      { status: 401 }
    )
  }

  const verified = await verifyApiKey(raw.trim())
  if (!verified) {
    return NextResponse.json(
      scanApiErrorPayload('Invalid API key', 401, 'INVALID_API_KEY', {
        reason: 'INVALID_API_KEY',
        severity: 'high',
      }),
      { status: 401 }
    )
  }

  const entitled = await userEntitledForProductAccess(verified.userId)
  if (!entitled) {
    return NextResponse.json(
      scanApiErrorPayload(
        'Active subscription required. Complete onboarding or choose a plan in the dashboard.',
        403,
        'SUBSCRIPTION_REQUIRED',
        { reason: 'SUBSCRIPTION_REQUIRED', severity: 'medium' }
      ),
      { status: 403 }
    )
  }

  const tier: SubscriptionTier = await subscriptionService.getTierForUser(verified.userId)
  const rateKeyId = verified.schema === 'v2' ? verified.keyUuid : verified.keyId
  const rate = await enforceRateLimit(`intel:${rateKeyId}:${tier}`, tier)
  if (!rate.ok) {
    const retrySec = Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000))
    return NextResponse.json(
      scanApiErrorPayload('Rate limit exceeded', 429, 'RATE_LIMIT', {
        reason: 'RATE_LIMIT',
        severity: 'medium',
      }),
      {
        status: 429,
        headers: {
          'Retry-After': String(retrySec),
          ...rateLimitHeaderTriple({ limit: rate.limit, remaining: rate.remaining, reset: rate.reset }),
        },
      }
    )
  }

  void touchVerifiedApiKeyLastUsed(verified)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const mintAddress = typeof body.mintAddress === 'string' ? body.mintAddress.trim() : ''
  const fresh = body.fresh === true
  const onlyTicker = body.only === 'ticker'

  if (!mintAddress || !isValidSolanaMint(mintAddress)) {
    return NextResponse.json(
      scanApiErrorPayload('Invalid mint address', 400, 'INVALID_MINT', {
        reason: 'INVALID_MINT',
        severity: 'low',
      }),
      { status: 400 }
    )
  }

  const keyTier = verified.schema === 'v1' ? 'v1' : 'v2'
  const publicTier = subscriptionTierToPublic(tier)

  const ttl = onlyTicker ? 10 : 60
  const cacheKey = onlyTicker ? `intel:ticker:${mintAddress}` : `intel:report:${mintAddress}:${keyTier}`
  const skipCache = fresh && keyTier === 'v2'

  const extraHeaders: Record<string, string> = {}
  if (fresh && keyTier === 'v1') {
    extraHeaders['X-Cache-Fresh-Ignored'] = 'v1-only-bypasses-cache-for-v2'
  }

  if (!skipCache) {
    const cached = await intelCacheGetJson<TokenIntelligenceReport>(cacheKey)
    if (cached) {
      return NextResponse.json(withApproxCacheAge(cached, ttl), { headers: extraHeaders })
    }
  }

  const scanId = randomUUID()

  try {
    const report = await buildTokenIntelligenceReport({
      mint: mintAddress,
      keyTier,
      publicTier,
      scanId,
      onlyTicker,
    })

    void insertScanHistoryFireAndForget({
      userId: verified.userId,
      mint: mintAddress,
      riskScore: report.riskScore ?? null,
      verdict: report.riskVerdict ?? null,
      scanId,
    })

    if (!skipCache) {
      await intelCacheSetJson(cacheKey, report, ttl)
    }

    return NextResponse.json(report, { headers: extraHeaders })
  } catch (e) {
    console.error('[intelligence/scan]', e)
    if (e instanceof TokenNotFoundError) {
      return NextResponse.json(
        scanApiErrorPayload('Token not found', 404, 'TOKEN_NOT_FOUND', {
          reason: 'TOKEN_NOT_FOUND',
          severity: 'medium',
        }),
        { status: 404 }
      )
    }
    return NextResponse.json(
      scanApiErrorPayload('Upstream intelligence sources unavailable', 502, 'UPSTREAM_ERROR', {
        reason: 'UPSTREAM_ERROR',
        severity: 'high',
      }),
      { status: 502 }
    )
  }
}
