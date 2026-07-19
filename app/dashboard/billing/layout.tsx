import { requireAuthenticatedPage } from '@/lib/operator/require-operator'

export const dynamic = 'force-dynamic'

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedPage('/dashboard/billing')
  return children
}
