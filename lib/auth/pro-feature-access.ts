import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequestOptional } from '@/lib/middleware/with-api-auth'
import { subscriptionService } from '@/lib/services/subscription.service'
import type { SubscriptionTier } from '@/lib/types/tier'

export function isProOrInstitutional(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'institutional'
}

export async function getSessionUserIdAndTier(
  req: NextRequest
): Promise<{ userId: string; tier: SubscriptionTier } | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const tier = await subscriptionService.getTierForUser(user.id)
  return { userId: user.id, tier }
}

export type ProFeatureContext = {
  userId: string
  tier: SubscriptionTier
  via: 'api_key' | 'session'
}

/**
 * Deep-analysis / institutional features: valid API key with Pro+ **or** Supabase session with Pro+.
 * Invalid API key (when header present) does not fall back to session.
 */
export async function resolveProFeatureAccess(req: NextRequest): Promise<
  { ok: true; ctx: ProFeatureContext } | { ok: false; response: NextResponse }
> {
  const api = await authenticateApiRequestOptional(req)
  if (api.kind === 'invalid') return { ok: false, response: api.response }
  if (api.kind === 'ok') {
    if (!isProOrInstitutional(api.ctx.tier)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Pro or Institutional subscription required for this resource' },
          { status: 403 }
        ),
      }
    }
    return { ok: true, ctx: { userId: api.ctx.userId, tier: api.ctx.tier, via: 'api_key' } }
  }

  const sess = await getSessionUserIdAndTier(req)
  if (!sess) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isProOrInstitutional(sess.tier)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Pro or Institutional subscription required for this resource' },
        { status: 403 }
      ),
    }
  }
  return { ok: true, ctx: { userId: sess.userId, tier: sess.tier, via: 'session' } }
}

export type ProFeatureHandler = (
  req: NextRequest,
  ctx: ProFeatureContext
) => Promise<Response> | Response

export function withProFeature(handler: ProFeatureHandler) {
  return async (req: NextRequest) => {
    const r = await resolveProFeatureAccess(req)
    if (r.ok === false) return r.response
    return handler(req, r.ctx)
  }
}
