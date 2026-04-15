import { NextRequest, NextResponse } from 'next/server'
import type { SubscriptionTier } from '@/lib/types/tier'
import { verifyApiKey, touchVerifiedApiKeyLastUsed } from '@/lib/services/api-key.service'
import { enforceRateLimit } from '@/lib/services/rate-limit.service'
import { subscriptionService } from '@/lib/services/subscription.service'
import { logSecurityEvent } from '@/lib/services/security-log.service'
import { mergeWithRateLimitHeaders, scanApiErrorPayload } from '@/lib/api/scan-api-errors'

export type ApiAuthContext = {
  userId: string
  apiKeyId: string
  tier: SubscriptionTier
  keySchema: 'v1' | 'v2'
  /** v2 Sentinel public `key_id` (not the secret). */
  institutionalKeyPublicId?: string
  keyVersion?: number
}

export function extractRawApiKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const v = auth.slice(7).trim()
    return v || null
  }
  return req.headers.get('x-api-key')?.trim() || null
}

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
}

async function authenticateRawApiKey(
  req: NextRequest,
  raw: string
): Promise<{ ok: true; ctx: ApiAuthContext } | { ok: false; response: NextResponse }> {
  const verified = await verifyApiKey(raw.trim())
  if (!verified) {
    await logSecurityEvent({
      action: 'api_key_denied',
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: { path: req.nextUrl.pathname, reason: 'invalid_or_revoked' },
    })
    return {
      ok: false,
      response: NextResponse.json(
        scanApiErrorPayload('Invalid API key', 401, 'INVALID_API_KEY', {
          reason: 'INVALID_API_KEY',
          severity: 'high',
        }),
        { status: 401 }
      ),
    }
  }

  const tier = await subscriptionService.getTierForUser(verified.userId)
  const rateKeyId = verified.schema === 'v2' ? verified.keyUuid : verified.keyId
  const rate = await enforceRateLimit(`key:${rateKeyId}`, tier)
  if (!rate.ok) {
    const retrySec = Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000))
    return {
      ok: false,
      response: NextResponse.json(
        scanApiErrorPayload('Rate limit exceeded', 429, 'RATE_LIMIT', {
          reason: 'RATE_LIMIT',
          severity: 'medium',
        }),
        {
          status: 429,
          headers: {
            'Retry-After': String(retrySec),
            ...mergeWithRateLimitHeaders({ limit: rate.limit, remaining: rate.remaining, reset: rate.reset }),
          },
        }
      ),
    }
  }

  void touchVerifiedApiKeyLastUsed(verified)

  const ctx: ApiAuthContext = {
    userId: verified.userId,
    apiKeyId: rateKeyId,
    tier,
    keySchema: verified.schema,
    ...(verified.schema === 'v2'
      ? { keyVersion: verified.keyVersion, institutionalKeyPublicId: verified.keyId }
      : {}),
  }

  return {
    ok: true,
    ctx,
  }
}

/**
 * When no API key headers are sent, returns `no_api_key` so callers can fall back to session auth.
 * If headers are present but invalid, returns `invalid` with a response (do not fall back).
 */
export async function authenticateApiRequestOptional(req: NextRequest): Promise<
  | { kind: 'no_api_key' }
  | { kind: 'invalid'; response: NextResponse }
  | { kind: 'ok'; ctx: ApiAuthContext }
> {
  const raw = extractRawApiKey(req)
  if (!raw) return { kind: 'no_api_key' }
  const result = await authenticateRawApiKey(req, raw)
  if (result.ok === false) return { kind: 'invalid', response: result.response }
  return { kind: 'ok', ctx: result.ctx }
}

/**
 * Validates `Authorization: Bearer` or `X-API-Key`, SHA-256 lookup, tier-based Redis sliding window.
 */
export async function authenticateApiRequest(req: NextRequest): Promise<
  { ok: true; ctx: ApiAuthContext } | { ok: false; response: NextResponse }
> {
  const raw = extractRawApiKey(req)
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        scanApiErrorPayload('Missing API key', 401, 'MISSING_API_KEY', {
          reason: 'MISSING_API_KEY',
          severity: 'medium',
        }),
        { status: 401 }
      ),
    }
  }
  return authenticateRawApiKey(req, raw)
}

export type ApiHandlerWithAuth = (req: NextRequest, ctx: ApiAuthContext) => Promise<Response> | Response

export function withApiAuth(handler: ApiHandlerWithAuth) {
  return async (req: NextRequest) => {
    const result = await authenticateApiRequest(req)
    if (result.ok === false) return result.response
    return handler(req, result.ctx)
  }
}
