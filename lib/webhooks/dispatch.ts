import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { canUseInstitutionalWebhooks } from '@/lib/webhooks/enterprise-gate'
import { deliverWebhookHttp } from '@/lib/webhooks/deliver'
import { enqueueWebhookRetry } from '@/lib/webhooks/retry-queue'
import type { WebhookDispatchEvent } from '@/lib/webhooks/types'

function hookSubscribes(hookEvents: string[] | null | undefined, event: WebhookDispatchEvent): boolean {
  const ev = hookEvents ?? []
  if (ev.includes(event)) return true
  if (event === 'risk.changed' && ev.includes('risk_status_change')) return true
  return false
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

async function onFirstAttemptSuccess(webhookId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb
    .from('institutional_webhooks')
    .update({
      consecutive_failures: 0,
      last_success_at: new Date().toISOString(),
    })
    .eq('id', webhookId)
}

/**
 * Delivers to all active ENTERPRISE hooks subscribed to `event`.
 * First attempt runs inline; failures enqueue cron-driven retries (see `processWebhookRetryQueue`).
 */
export async function dispatchInstitutionalWebhooks(
  userId: string,
  event: WebhookDispatchEvent,
  payload: Record<string, unknown>
): Promise<void> {
  if (!(await canUseInstitutionalWebhooks(userId))) return

  const sb = getSupabaseAdmin()
  const { data: hooks, error } = await sb
    .from('institutional_webhooks')
    .select('id, url, secret, events, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !hooks?.length) return

  const targets = hooks.filter((h) => hookSubscribes(h.events as string[], event))
  if (!targets.length) return

  await Promise.allSettled(
    targets.map(async (h) => {
      const result = await deliverWebhookHttp(h.url, h.secret, event, payload)
      await recordDelivery(h.id, event, payload, result)
      if (result.ok) {
        await onFirstAttemptSuccess(h.id)
        return
      }
      await enqueueWebhookRetry({ webhookId: h.id, event, payload })
    })
  )
}
