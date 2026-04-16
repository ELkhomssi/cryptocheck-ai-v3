import { NextRequest, NextResponse } from 'next/server'
import { isSentinelQaBypassKeyUuid } from '@/lib/config/sentinel-qa-bypass'
import { TIER_RATE_LIMITS } from '@/lib/config/tiers'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verifyApiKey, touchVerifiedApiKeyLastUsed, type VerifiedApiKey } from '@/lib/services/api-key.service'
import { logSecurityEvent } from '@/lib/services/security-log.service'
import { subscriptionService } from '@/lib/services/subscription.service'
import { subscriptionTierToPublic } from '@/lib/types/intelligence'

export const dynamic = 'force-dynamic'

const VERIFY_FAIL_WINDOW_MS = 5 * 60 * 1000
const VERIFY_FAIL_MAX = 5

const verifyFailuresByIp = new Map<string, number[]>()

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  )
}

function pruneAndRecordFailure(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now()
  const prev = (verifyFailuresByIp.get(ip) || []).filter((t) => now - t < VERIFY_FAIL_WINDOW_MS)
  prev.push(now)
  verifyFailuresByIp.set(ip, prev)
  if (prev.length <= VERIFY_FAIL_MAX) {
    return { blocked: false, retryAfterSec: 0 }
  }
  const oldest = prev[0]
  const resetAt = oldest + VERIFY_FAIL_WINDOW_MS
  return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)) }
}

function clearFailures(ip: string): void {
  verifyFailuresByIp.delete(ip)
}

async function fetchKeyName(verified: VerifiedApiKey): Promise<string> {
  if (verified.schema === 'v2' && isSentinelQaBypassKeyUuid(verified.keyUuid)) {
    return 'QA Sentinel'
  }
  const sb = getSupabaseAdmin()
  if (verified.schema === 'v1') {
    const { data, error } = await sb.from('api_keys').select('name').eq('id', verified.keyId).maybeSingle()
    if (error || !data?.name) return 'API Key'
    return String(data.name)
  }
  const { data, error } = await sb.from('api_keys_v2').select('name').eq('id', verified.keyUuid).maybeSingle()
  if (error || !data?.name) return 'Sentinel Key'
  return String(data.name)
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req) || 'unknown'

  let rawKey = ''
  try {
    const body = await req.json()
    rawKey = typeof body?.key === 'string' ? body.key.trim() : ''
  } catch {
    rawKey = ''
  }

  if (!rawKey) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  }

  const verified = await verifyApiKey(rawKey)
  if (!verified) {
    const { blocked, retryAfterSec } = pruneAndRecordFailure(ip)
    if (blocked) {
      await logSecurityEvent({
        action: 'key_verify_rate_limited',
        ip,
        userAgent: req.headers.get('user-agent'),
        metadata: { path: '/api/v1/keys/verify' },
      })
      return NextResponse.json(
        { error: 'Too many attempts', retryAfter: retryAfterSec },
        { status: 429 }
      )
    }
    await logSecurityEvent({
      action: 'api_key_denied',
      ip,
      userAgent: req.headers.get('user-agent'),
      metadata: { path: '/api/v1/keys/verify', reason: 'invalid_or_revoked' },
    })
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  }

  clearFailures(ip)

  const tier = await subscriptionService.getTierForUser(verified.userId)
  const rl = TIER_RATE_LIMITS[tier]

  let keyName: string
  try {
    keyName = await fetchKeyName(verified)
  } catch (e) {
    console.error('[keys/verify] name lookup', e)
    keyName = verified.schema === 'v1' ? 'API Key' : 'Sentinel Key'
  }

  await touchVerifiedApiKeyLastUsed(verified)

  await logSecurityEvent({
    userId: verified.userId,
    apiKeyId: verified.schema === 'v1' ? verified.keyId : null,
    apiKeyV2Id: verified.schema === 'v2' ? verified.keyUuid : null,
    action: 'key_verified',
    ip,
    userAgent: req.headers.get('user-agent'),
    metadata: { path: '/api/v1/keys/verify', keyTier: verified.schema },
  })

  return NextResponse.json({
    valid: true,
    keyTier: verified.schema === 'v1' ? 'v1' : 'v2',
    keyName,
    subscriptionTier: subscriptionTierToPublic(tier),
    rateLimit: {
      maxRequests: rl.maxRequests,
      windowSeconds: rl.windowSeconds,
    },
  })
}
