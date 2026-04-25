import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { WEBHOOK_DISABLE_AFTER_FAILURES, WEBHOOK_MAX_ATTEMPTS, WEBHOOK_RETRY_GAP_MS } from '@/lib/webhooks/constants'
import { deliverWebhookHttp } from '@/lib/webhooks/deliver'
import type { WebhookDispatchEvent } from '@/lib/webhooks/types'

export async function enqueueWebhookRetry(params: {
  webhookId: string
  event: WebhookDispatchEvent
  payload: Record<string, unknown>
}): Promise<void> {
  const sb = getSupabaseAdmin()
  const gap = WEBHOOK_RETRY_GAP_MS[0]
  await sb.from('institutional_webhook_retry_queue').insert({
    webhook_id: params.webhookId,
    event: params.event,
    payload: params.payload,
    pending_attempt: 2,
    next_retry_at: new Date(Date.now() + gap).toISOString(),
  })
}

async function recordDelivery(
  webhookId: string,
  event: WebhookDispatchEvent,
  payload: Record<string, unknown>,
  result: { ok: boolean; httpStatus: number | null; error?: string }
): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb.from('institutional_webhook_deliveries').insert({
    webhook_id: webhookId,
    event,
    payload,
    http_status: result.httpStatus,
    succeeded: result.ok,
    error_message: result.ok ? null : (result.error ?? 'failed').slice(0, 2000),
  })
}

async function onWebhookDeliverySuccess(webhookId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb
    .from('institutional_webhooks')
    .update({
      consecutive_failures: 0,
      last_success_at: new Date().toISOString(),
    })
    .eq('id', webhookId)
}

async function onWebhookDeliveryHardFail(webhookId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  const { data: row } = await sb
    .from('institutional_webhooks')
    .select('consecutive_failures')
    .eq('id', webhookId)
    .maybeSingle()
  const prev = typeof row?.consecutive_failures === 'number' ? row.consecutive_failures : 0
  const next = prev + 1
  const patch: Record<string, unknown> = { consecutive_failures: next }
  if (next >= WEBHOOK_DISABLE_AFTER_FAILURES) patch.is_active = false
  await sb.from('institutional_webhooks').update(patch).eq('id', webhookId)
}

export async function processWebhookRetryQueue(params: { limit?: number }): Promise<{
  processed: number
  succeeded: number
  failed: number
  rescheduled: number
}> {
  const sb = getSupabaseAdmin()
  const limit = params.limit ?? 40
  const { data: rows, error } = await sb
    .from('institutional_webhook_retry_queue')
    .select('id, webhook_id, event, payload, pending_attempt')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(limit)

  if (error || !rows?.length) {
    return { processed: 0, succeeded: 0, failed: 0, rescheduled: 0 }
  }

  let succeeded = 0
  let terminalFailures = 0
  let rescheduled = 0

  for (const row of rows) {
    const { data: hook } = await sb
      .from('institutional_webhooks')
      .select('id, url, secret, is_active')
      .eq('id', row.webhook_id)
      .maybeSingle()

    if (!hook?.is_active || !hook.url || !hook.secret) {
      await sb.from('institutional_webhook_retry_queue').delete().eq('id', row.id)
      terminalFailures++
      continue
    }

    const event = row.event as WebhookDispatchEvent
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const result = await deliverWebhookHttp(hook.url, hook.secret, event, payload)
    await recordDelivery(hook.id, event, payload, result)

    if (result.ok) {
      await sb.from('institutional_webhook_retry_queue').delete().eq('id', row.id)
      await onWebhookDeliverySuccess(hook.id)
      succeeded++
      continue
    }

    const attempt = row.pending_attempt
    if (attempt >= WEBHOOK_MAX_ATTEMPTS) {
      await sb.from('institutional_webhook_retry_queue').delete().eq('id', row.id)
      await onWebhookDeliveryHardFail(hook.id)
      terminalFailures++
      continue
    }

    const nextAttempt = attempt + 1
    const gapMs = WEBHOOK_RETRY_GAP_MS[attempt - 1] ?? WEBHOOK_RETRY_GAP_MS[WEBHOOK_RETRY_GAP_MS.length - 1]
    await sb
      .from('institutional_webhook_retry_queue')
      .update({
        pending_attempt: nextAttempt,
        next_retry_at: new Date(Date.now() + gapMs).toISOString(),
      })
      .eq('id', row.id)
    rescheduled++
  }

  return { processed: rows.length, succeeded, failed: terminalFailures, rescheduled }
}
