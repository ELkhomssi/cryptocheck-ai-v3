import { requireAuthenticatedPage } from '@/lib/operator/require-operator'
import WebhooksClient from './webhooks-client'

/** Enterprise webhooks UI — session required; Enterprise enforced on APIs. */
export const dynamic = 'force-dynamic'

export default async function DashboardWebhooksPage() {
  await requireAuthenticatedPage('/dashboard/webhooks')
  return <WebhooksClient />
}
