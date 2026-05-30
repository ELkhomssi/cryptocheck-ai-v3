import 'server-only'

import { signWebhookBody } from '@/lib/webhooks/signing'

const WEBHOOK_TIMEOUT_MS = 4000

export type B2BWebhookEvent = {
  event: 'risk.assessed'
  partnerId: string
  payload: Record<string, unknown>
}

function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Fire-and-forget delivery to a partner-supplied webhook URL.
 * Signs the raw body with the partner secret (HMAC-SHA256 hex) when provided.
 */
export function deliverPartnerWebhook(
  webhookUrl: string,
  event: B2BWebhookEvent,
  secret?: string
): void {
  if (!isHttpsUrl(webhookUrl)) return

  void (async () => {
    const body = JSON.stringify({
      event: event.event,
      sent_at: new Date().toISOString(),
      partner_id: event.partnerId,
      payload: event.payload,
    })
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CCAI-Event': event.event,
      'X-CryptoCheck-Timestamp': String(Math.floor(Date.now() / 1000)),
    }
    if (secret) {
      headers['X-CCAI-Signature'] = `sha256=${signWebhookBody(secret, body)}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    try {
      await fetch(webhookUrl, { method: 'POST', headers, body, signal: controller.signal })
    } catch {
      /* delivery is best-effort; partners poll reputation as fallback */
    } finally {
      clearTimeout(timer)
    }
  })()
}
