import { createHmac } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type WebhookEvent = 'high_safety_token' | 'risk_status_change'

export type InstitutionalWebhook = {
  id: string
  user_id: string
  url: string
  secret: string
  events: WebhookEvent[]
  created_at: string
}

/**
 * Institutional webhook delivery (scaffold).
 * Register rows in `institutional_webhooks` when migration is applied; otherwise no-op dispatch.
 */
export class WebhookService {
  static signPayload(secret: string, body: string): string {
    return createHmac('sha256', secret).update(body).digest('hex')
  }

  static async listForUser(userId: string): Promise<InstitutionalWebhook[]> {
    try {
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('institutional_webhooks')
        .select('id, user_id, url, secret, events, created_at')
        .eq('user_id', userId)
      if (error || !data) return []
      return data as InstitutionalWebhook[]
    } catch {
      return []
    }
  }

  static async dispatch(userId: string, event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
    const hooks = await WebhookService.listForUser(userId)
    const targets = hooks.filter((h) => h.events?.includes(event))
    if (!targets.length) return

    const body = JSON.stringify({
      event,
      sent_at: new Date().toISOString(),
      payload,
    })

    await Promise.allSettled(
      targets.map(async (h) => {
        const sig = WebhookService.signPayload(h.secret, body)
        await fetch(h.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CryptoCheck-Signature': sig,
            'User-Agent': 'CryptoCheckAI-Webhook/1.0',
          },
          body,
          signal: AbortSignal.timeout(8000),
        })
      })
    )
  }
}
