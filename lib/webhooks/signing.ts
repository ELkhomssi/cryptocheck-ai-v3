import { createHmac } from 'crypto'

export function signWebhookBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}
