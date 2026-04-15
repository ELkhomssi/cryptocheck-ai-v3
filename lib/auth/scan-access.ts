import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequestOptional } from '@/lib/middleware/with-api-auth'
import { enforceDailyApiLimit } from '@/lib/services/api-daily-limit.service'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { getSessionUserIdAndTier, isProOrInstitutional } from '@/lib/auth/pro-feature-access'

/** Extends dashboard context with optional API key id for usage logging. */
export type ScanAccessContext = ProFeatureContext & { apiKeyId?: string }

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

/**
 * Same authentication as `resolveScanAccess` but **without** consuming daily quota.
 * Use when charging quota in bulk (e.g. batch scan).
 */
export async function resolveScanAuthOnly(req: NextRequest): Promise<
  { ok: true; ctx: ScanAccessContext } | { ok: false; response: NextResponse }
> {
  const api = await authenticateApiRequestOptional(req)
  if (api.kind === 'invalid') return { ok: false, response: api.response }

  if (api.kind === 'ok') {
    return {
      ok: true,
      ctx: { userId: api.ctx.userId, tier: api.ctx.tier, via: 'api_key', apiKeyId: api.ctx.apiKeyId },
    }
  }

  const sess = await getSessionUserIdAndTier(req)
  if (!sess) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Authentication required. Send Authorization: Bearer <api_key> or sign in.',
          code: 401,
          reason: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    }
  }
  if (!isProOrInstitutional(sess.tier)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Pro or Institutional subscription required for browser session access. Use an API key for free-tier developer access.',
          code: 403,
          reason: 'FORBIDDEN',
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true, ctx: { userId: sess.userId, tier: sess.tier, via: 'session' } }
}

/**
 * Security Intelligence API access:
 * - **API key** (Bearer / X-API-Key): any subscription tier; daily quota by tier (free 10 / pro 1k / enterprise cap).
 * - **Session cookie**: Pro or Institutional only (dashboard parity); daily quota applies.
 */
export async function resolveScanAccess(req: NextRequest): Promise<
  { ok: true; ctx: ScanAccessContext } | { ok: false; response: NextResponse }
> {
  const api = await authenticateApiRequestOptional(req)
  if (api.kind === 'invalid') return { ok: false, response: api.response }

  if (api.kind === 'ok') {
    const daily = await enforceDailyApiLimit(`apikey:${api.ctx.apiKeyId}`, api.ctx.tier)
    if (!daily.ok) {
      const retrySec = Math.max(1, Math.ceil((daily.reset - Date.now()) / 1000))
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Daily API quota exceeded for your plan',
            code: 429,
            reason: 'DAILY_QUOTA',
            limit: daily.limit,
            reset: daily.reset,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(retrySec),
              'X-RateLimit-Limit': String(daily.limit),
              'X-RateLimit-Remaining': String(daily.remaining),
              'X-RateLimit-Reset': String(daily.reset),
            },
          }
        ),
      }
    }
    return {
      ok: true,
      ctx: { userId: api.ctx.userId, tier: api.ctx.tier, via: 'api_key', apiKeyId: api.ctx.apiKeyId },
    }
  }

  const sess = await getSessionUserIdAndTier(req)
  if (!sess) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Authentication required. Send Authorization: Bearer <api_key> or sign in.',
          code: 401,
          reason: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    }
  }
  if (!isProOrInstitutional(sess.tier)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Pro or Institutional subscription required for browser session access. Use an API key for free-tier developer access.',
          code: 403,
          reason: 'FORBIDDEN',
        },
        { status: 403 }
      ),
    }
  }

  const daily = await enforceDailyApiLimit(`session:${sess.userId}`, sess.tier)
  if (!daily.ok) {
    const retrySec = Math.max(1, Math.ceil((daily.reset - Date.now()) / 1000))
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Daily API quota exceeded for your plan',
          code: 429,
          reason: 'DAILY_QUOTA',
          limit: daily.limit,
          reset: daily.reset,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retrySec) },
        }
      ),
    }
  }

  return { ok: true, ctx: { userId: sess.userId, tier: sess.tier, via: 'session' } }
}

export type ScanAccessHandler = (req: NextRequest, ctx: ScanAccessContext) => Promise<Response> | Response

export function withScanAccess(handler: ScanAccessHandler) {
  return async (req: NextRequest) => {
    const r = await resolveScanAccess(req)
    if (r.ok === false) return r.response
    return handler(req, r.ctx)
  }
}

/** For logging / analytics */
export { clientIp as scanClientIp }
