import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSignalForMint } from '@/lib/services/signals/generate-signal'
import { redis } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIER_LIMITS = {
  free: { allowed: false },
  micropack: { allowed: false },
  pro: { allowed: true, callsPerDay: 20 },
  elite: { allowed: true, callsPerDay: 100 },
  developer: { allowed: true, callsPerDay: 50 },
  enterprise: { allowed: true, callsPerDay: 1000 },
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
    if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()

    const tier = (profile?.tier ?? 'free') as keyof typeof TIER_LIMITS
    const limits = TIER_LIMITS[tier]

    if (!limits.allowed) {
      return NextResponse.json(
        {
          error: 'AI Intelligence requires Pro or higher',
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
      return NextResponse.json({ error: 'Daily limit reached' }, { status: 429 })
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
    return NextResponse.json(
      {
        error: 'Signal generation failed',
      },
      { status: 500 }
    )
  }
}
