import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/services/api-key.service'
import { createInstitutionalApiKey, listInstitutionalApiKeys, revokeInstitutionalApiKey } from '@/lib/services/api-key-v2.service'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'
import { subscriptionService } from '@/lib/services/subscription.service'
import { logSecurityEvent } from '@/lib/services/security-log.service'

async function getSessionUser(req: NextRequest) {
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
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

/** Session-authenticated API key lifecycle (create / list / revoke). Raw secret returned once on create. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureFreeTierSubscription(user.id)
  const [v1, v2] = await Promise.all([listApiKeys(user.id), listInstitutionalApiKeys(user.id)])
  const keys = [
    ...v1.map((k) => ({
      schema: 'v1' as const,
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      status: k.revoked_at ? ('revoked' as const) : ('active' as const),
    })),
    ...v2.map((k) => ({
      schema: 'v2' as const,
      id: k.id,
      key_id: k.key_id,
      name: k.name,
      key_prefix: k.key_prefix,
      tier: k.tier,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      status: k.revoked_at ? ('revoked' as const) : k.status === 'revoked' ? ('revoked' as const) : ('active' as const),
    })),
  ]
  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureFreeTierSubscription(user.id)
  const body = await req.json().catch(() => ({})) as { name?: string; schema?: string }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Default'
  const useSentinelV2 = body.schema === 'v2' || body.schema === 'sentinel'

  if (useSentinelV2) {
    const tier = await subscriptionService.getTierForUser(user.id)
    if (tier === 'free') {
      return NextResponse.json(
        {
          error:
            'SENTINEL (v2) keys require Pro or Enterprise. Upgrade or create a legacy cc_live_ (v1) key.',
        },
        { status: 403 }
      )
    }
    const created = await createInstitutionalApiKey(user.id, name, {
      tier: tier === 'institutional' ? 'institutional' : 'pro',
    })
    await logSecurityEvent({
      userId: user.id,
      apiKeyV2Id: created.id,
      action: 'api_key_v2_created',
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: { name, key_id: created.key_id, schema: 'v2' },
    })
    return NextResponse.json({
      schema: 'v2',
      id: created.id,
      key_id: created.key_id,
      name: created.name,
      key_prefix: created.key_prefix,
      created_at: created.created_at,
      secret: created.rawKey,
    })
  }

  const created = await createApiKey(user.id, name)
  await logSecurityEvent({
    userId: user.id,
    apiKeyId: created.id,
    action: 'api_key_created',
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent'),
    metadata: { name },
  })
  return NextResponse.json({
    schema: 'v1',
    id: created.id,
    name: created.name,
    key_prefix: created.key_prefix,
    created_at: created.created_at,
    secret: created.secret,
  })
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  const schema = req.nextUrl.searchParams.get('schema') || 'v1'
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (schema === 'v2' || schema === 'sentinel') {
    const ok = await revokeInstitutionalApiKey(user.id, id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logSecurityEvent({
      userId: user.id,
      action: 'api_key_v2_revoked',
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
      metadata: { keyUuid: id },
    })
    return NextResponse.json({ ok: true })
  }

  const ok = await revokeApiKey(user.id, id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await logSecurityEvent({
    userId: user.id,
    action: 'api_key_revoked',
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent'),
    metadata: { keyId: id },
  })
  return NextResponse.json({ ok: true })
}
