import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
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

function normalizeEvents(raw: unknown): WebhookDispatchEvent[] {
  if (!Array.isArray(raw)) return ['scan.completed', 'risk.changed']
  const out = raw.filter((e): e is WebhookDispatchEvent => typeof e === 'string' && (ALLOWED as string[]).includes(e))
  return out.length ? out : ['scan.completed', 'risk.changed']
}

function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canUseInstitutionalWebhooks(user.id))) {
    return NextResponse.json({ error: 'Enterprise subscription required' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('institutional_webhooks')
    .select('id, url, events, is_active, consecutive_failures, last_success_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ webhooks: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canUseInstitutionalWebhooks(user.id))) {
    return NextResponse.json({ error: 'Enterprise subscription required' }, { status: 403 })
  }

  let body: { url?: string; events?: unknown }
  try {
    body = (await req.json()) as { url?: string; events?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url || !isHttpsUrl(url)) {
    return NextResponse.json({ error: 'url must be a valid https URL' }, { status: 400 })
  }

  const events = normalizeEvents(body.events)
  const secret = randomBytes(32).toString('hex')

  const { data, error } = await supabase
    .from('institutional_webhooks')
    .insert({
      user_id: user.id,
      url,
      secret,
      events,
      is_active: true,
      consecutive_failures: 0,
    })
    .select('id, url, events, is_active, consecutive_failures, last_success_at, created_at')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ webhook: data, secret })
}
