/** Payload event ids sent to customer endpoints (and stored in `institutional_webhooks.events`). */
export type WebhookDispatchEvent =
  | 'scan.completed'
  | 'risk.changed'
  | 'whale.moved'
  | 'high_safety_token'
  | 'risk_status_change'

export type InstitutionalWebhookRow = {
  id: string
  user_id: string
  url: string
  secret: string
  events: string[]
  is_active: boolean
  consecutive_failures: number
  last_success_at: string | null
  created_at: string
}
