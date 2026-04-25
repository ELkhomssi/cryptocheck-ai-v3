import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { dispatchInstitutionalWebhooks } from '@/lib/webhooks/dispatch'
import { signWebhookBody } from '@/lib/webhooks/signing'
import type { WebhookDispatchEvent } from '@/lib/webhooks/types'

export type WebhookEvent = WebhookDispatchEvent

export type InstitutionalWebhook = {
  id: string
  user_id: string
  url: string
  secret: string
  events: WebhookEvent[]
  is_active: boolean
  consecutive_failures: number
  last_success_at: string | null
  created_at: string
}

export class WebhookService {
  static signPayload(secret: string, body: string): string {
    return signWebhookBody(secret, body)
  }

  static async listForUser(userId: string): Promise<InstitutionalWebhook[]> {
    try {
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('institutional_webhooks')
        .select('id, user_id, url, secret, events, is_active, consecutive_failures, last_success_at, created_at')
        .eq('user_id', userId)
      if (error || !data) return []
      return data as InstitutionalWebhook[]
    } catch {
      return []
    }
  }

  static async dispatch(userId: string, event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
    await dispatchInstitutionalWebhooks(userId, event, payload)
  }
}
