import { dispatchInstitutionalWebhooks } from '@/lib/webhooks/dispatch'

/** Placeholder for future whale / large-move signals (no stable cron source yet). */
export function dispatchWhaleMovedWebhook(userId: string, payload: Record<string, unknown>): void {
  void dispatchInstitutionalWebhooks(userId, 'whale.moved', payload)
}
