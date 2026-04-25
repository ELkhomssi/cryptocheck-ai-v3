import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canUseInstitutionalWebhooks } from '@/lib/webhooks/enterprise-gate'
import { deliverWebhookHttp } from '@/lib/webhooks/deliver'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canUseInstitutionalWebhooks(user.id))) {
    return NextResponse.json({ error: 'Enterprise subscription required' }, { status: 403 })
  }

  let body: { webhookId?: string }
  try {
    body = (await req.json()) as { webhookId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const webhookId = typeof body.webhookId === 'string' ? body.webhookId.trim() : ''
  if (!webhookId) return NextResponse.json({ error: 'webhookId required' }, { status: 400 })

  const { data: hook, error } = await supabase
    .from('institutional_webhooks')
    .select('id, url, secret, is_active')
    .eq('id', webhookId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !hook?.url || !hook.secret) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }
  if (!hook.is_active) return NextResponse.json({ error: 'Webhook is disabled' }, { status: 400 })

  const payload = { test: true, initiatedBy: user.id }
  const result = await deliverWebhookHttp(hook.url, hook.secret, 'scan.completed', payload)

  const sb = getSupabaseAdmin()
  await sb.from('institutional_webhook_deliveries').insert({
    webhook_id: hook.id,
    event: 'scan.completed',
    payload,
    http_status: result.httpStatus,
    succeeded: result.ok,
    error_message: result.ok ? null : (result.error ?? 'failed').slice(0, 2000),
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, httpStatus: result.httpStatus, error: result.error ?? 'delivery_failed' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, httpStatus: result.httpStatus })
}
