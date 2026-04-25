import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSignalForMint } from '@/lib/services/signals/generate-signal'
import { redis } from '@/lib/cache/redis'
import { getSignalLimitsForProfileTier } from '@/lib/api/intelligence-signal-tier'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function classifySignalFailure(err: unknown): { code: string; hint: string } {
  const msg = err instanceof Error ? err.message : String(err)
  const m = msg.toLowerCase()

  if (msg.includes('Helius API 401') || /helius api\s*401/i.test(msg)) {
    return {
      code: 'HELIUS_UNAUTHORIZED',
      hint: 'Helius returned 401 — key missing, revoked, or wrong project. Set HELIUS_API_KEY (or legacy HELIUS_KEY) in Vercel with no quotes/spaces.',
    }
  }
  if (
    m.includes('incorrect api key') ||
    m.includes('invalid_api_key') ||
    (m.includes('401') && m.includes('openai')) ||
    msg.includes('AuthenticationError')
  ) {
    return {
      code: 'OPENAI_UNAUTHORIZED',
      hint: 'OpenAI rejected the key (401). Set OPENAI_API_KEY (or legacy OPENAI_KEY) and redeploy.',
    }
  }
  if (m.includes('openai_api_key') || m.includes('openai_key') || (m.includes('openai') && m.includes('not configured'))) {
    return {
      code: 'OPENAI_NOT_CONFIGURED',
      hint: 'Server is missing OPENAI_API_KEY. Add it in Vercel/host env to enable consensus.',
    }
  }
  if (m.includes('helius') && (m.includes('403') || m.includes('429'))) {
    return {
      code: 'HELIUS_QUOTA_OR_FORBIDDEN',
      hint: 'Helius returned 403/429 — check plan limits and HELIUS_API_KEY scope.',
    }
  }
  if (m.includes('helius')) {
    return {
      code: 'HELIUS_DEGRADED',
      hint: 'Helius-related step failed. Whale flow may be empty; check HELIUS_API_KEY and RPC limits.',
    }
  }
  if (m.includes('zod') || m.includes('invalid_type') || m.includes('required') || m.includes('expected')) {
    return {
      code: 'MODEL_OUTPUT_INVALID',
      hint: 'OpenAI returned JSON that did not match the signal schema. Check logs for the raw validation error.',
    }
  }
  if (m.includes('supabase') || m.includes('intelligence_signals')) {
    return {
      code: 'DATABASE',
      hint: 'Supabase insert or query failed. Confirm supabase-signals-migration ran and service role key is set.',
    }
  }
  return {
    code: 'UNKNOWN',
    hint: msg.slice(0, 200) || 'See server logs for [signals] entries.',
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { mint: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Auth required', code: 'AUTH_REQUIRED', hint: 'Sign in to request AI signals.' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()

    const { key: tierKey, limits } = getSignalLimitsForProfileTier(profile?.tier)

    if (!limits.allowed) {
      return NextResponse.json(
        {
          error: 'AI Intelligence requires Pro or higher',
          code: 'TIER_NOT_ENTITLED',
          hint: `Your profile tier resolved to "${tierKey}". Upgrade for signal access.`,
          upgradeUrl: '/app',
        },
        { status: 403 }
      )
    }

    // Rate limit
    const today = new Date().toISOString().slice(0, 10)
    const key = `ai_signals:${user.id}:${today}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 86400)
    if ('callsPerDay' in limits && count > limits.callsPerDay) {
      return NextResponse.json(
        {
          error: 'Daily limit reached',
          code: 'RATE_LIMIT',
          hint: `Limit is ${limits.callsPerDay} requests per day for tier "${tierKey}".`,
        },
        { status: 429 }
      )
    }

    // 5-min cache
    const cacheKey = `signal:v1:${params.mint}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json({ ...JSON.parse(cached as string), cached: true })
    }

    const signal = await generateSignalForMint({
      mint: params.mint,
      userId: user.id,
    })

    await redis.setex(cacheKey, 300, JSON.stringify(signal))
    return NextResponse.json(signal)
  } catch (err) {
    console.error('[signals]', err)
    const { code, hint } = classifySignalFailure(err)
    const exposeDetail = process.env.NODE_ENV !== 'production'
    return NextResponse.json(
      {
        error: 'Intelligence diagnostic pipeline interrupted',
        code,
        hint,
        ...(exposeDetail && err instanceof Error ? { detail: err.message } : {}),
      },
      { status: 500 }
    )
  }
}
