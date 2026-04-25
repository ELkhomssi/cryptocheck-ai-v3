import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canUseInstitutionalWebhooks } from '@/lib/webhooks/enterprise-gate'
import type { WebhookDispatchEvent } from '@/lib/webhooks/types'

export const dynamic = 'force-dynamic'

const ALLOWED: WebhookDispatchEvent[] = [
  'scan.completed',
  'risk.changed',
  'whale.moved',
  'high_safety_token',
  'risk_status_change',
]

function normalizeEvents(raw: unknown): WebhookDispatchEvent[] | null {
  if (raw === undefined) return null
  if (!Array.isArray(raw)) return []
  return raw.filter((e): e is WebhookDispatchEvent => typeof e === 'string' && (ALLOWED as string[]).includes(e))
}

function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canUseInstitutionalWebhooks(user.id))) {
    return NextResponse.json({ error: 'Enterprise subscription required' }, { status: 403 })
  }

  let body: { url?: string; events?: unknown; is_active?: boolean }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.url === 'string') {
    const u = body.url.trim()
    if (!u || !isHttpsUrl(u)) return NextResponse.json({ error: 'url must be a valid https URL' }, { status: 400 })
    patch.url = u
  }
  if (body.events !== undefined) {
    const ev = normalizeEvents(body.events)
    if (!ev?.length) return NextResponse.json({ error: 'events must be a non-empty allowed list' }, { status: 400 })
    patch.events = ev
  }
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

  const { data, error } = await supabase
    .from('institutional_webhooks')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, url, events, is_active, consecutive_failures, last_success_at, created_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ webhook: data })
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canUseInstitutionalWebhooks(user.id))) {
    return NextResponse.json({ error: 'Enterprise subscription required' }, { status: 403 })
  }

  const { data: removed, error } = await supabase
    .from('institutional_webhooks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
