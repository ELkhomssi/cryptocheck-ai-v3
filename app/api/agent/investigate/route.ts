import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runInvestigationStream } from '@/lib/agents/investigation/stream'
import { redis } from '@/lib/cache/redis'
import { normalizeProfileTierForSignals } from '@/lib/api/intelligence-signal-tier'

export const runtime = 'nodejs'
export const maxDuration = 60 // up to 60s for multi-step agent

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Auth required', { status: 401 })

  // Tier + rate limit
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()
  const tierKey = normalizeProfileTierForSignals(profile?.tier)

  const limits: Record<string, number> = {
    free: 3,
    micropack: 5,
    pro: 50,
    elite: 100,
    developer: 50,
    enterprise: 500,
  }
  const dailyLimit = limits[tierKey] ?? 0
  if (dailyLimit === 0) {
    return Response.json({ error: 'Upgrade required' }, { status: 403 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const count = await redis.incr(`agent:${user.id}:${today}`)
  if (count === 1) await redis.expire(`agent:${user.id}:${today}`, 86400)
  if (count > dailyLimit) {
    return Response.json({ error: 'Daily limit reached' }, { status: 429 })
  }

  const payload = (await req.json()) as { mint?: string; prompt?: string }
  const mint = payload.mint ?? payload.prompt
  if (!mint || typeof mint !== 'string' || mint.trim().length < 32) {
    return Response.json({ error: 'Valid Solana mint required' }, { status: 400 })
  }

  const stream = runInvestigationStream({ mint: mint.trim(), userId: user.id })
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
