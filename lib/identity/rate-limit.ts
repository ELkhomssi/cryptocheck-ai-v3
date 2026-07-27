/**
 * Phase 18 — per-user RPM limits for intelligence-core + coach.
 */

import 'server-only'

import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/services/rate-limit.service'
import { isEntitled } from '@/lib/identity/entitlements'
import type { SubscriptionTier } from '@/lib/types/tier'

const VOICE_LIMIT =
  'Catching up — try again in a moment. I’ve paused this request so shared market feeds stay healthy for everyone.'

export async function enforceIdentityRateLimit(params: {
  userId: string | null
  walletAddress?: string | null
  route: string
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const id =
    params.userId ||
    (params.walletAddress ? `wallet:${params.walletAddress}` : null) ||
    'anon'
  let tier: SubscriptionTier = 'free'
  if (params.userId && (await isEntitled(params.userId, 'higher_rate_limits'))) {
    tier = 'pro'
  }
  const rl = await enforceRateLimit(`p18:${params.route}:${id}`, tier)
  if (rl.ok) return { ok: true }
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: 'rate_limited',
        message: VOICE_LIMIT,
        retryAfterSec: Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
        },
      },
    ),
  }
}
