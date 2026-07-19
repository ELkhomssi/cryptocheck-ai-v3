import { requireAuthenticatedPage } from '@/lib/operator/require-operator'
import ApiKeysPage from './ApiKeysClient'

/** Customer API keys — session required; not in trader primary nav. */
export const dynamic = 'force-dynamic'

export default async function DashboardApiKeysPage() {
  await requireAuthenticatedPage('/dashboard/api-keys')
  return <ApiKeysPage />
}
