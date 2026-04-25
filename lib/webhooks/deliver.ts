import { signWebhookBody } from '@/lib/webhooks/signing'
import type { WebhookDispatchEvent } from '@/lib/webhooks/types'

export type DeliverWebhookResult = {
  ok: boolean
  httpStatus: number | null
  error?: string
}

export async function deliverWebhookHttp(
  url: string,
  secret: string,
  event: WebhookDispatchEvent,
  payload: Record<string, unknown>
): Promise<DeliverWebhookResult> {
  const body = JSON.stringify({
    event,
    sent_at: new Date().toISOString(),
    payload,
  })
  const digest = signWebhookBody(secret, body)
  const ts = Math.floor(Date.now() / 1000).toString()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoCheckAI-Webhook/1.0',
        'X-CryptoCheck-Event': event,
        'X-CryptoCheck-Timestamp': ts,
        'X-CryptoCheck-Signature': `sha256=${digest}`,
      },
      body,
      signal: AbortSignal.timeout(12_000),
    })
    if (res.ok) return { ok: true, httpStatus: res.status }
    const snippet = (await res.text().catch(() => '')).slice(0, 500)
    return {
      ok: false,
      httpStatus: res.status,
      error: snippet || `HTTP ${res.status}`,
    }
  } catch (e) {
    return {
      ok: false,
      httpStatus: null,
      error: e instanceof Error ? e.message : 'fetch_failed',
    }
  }
}
