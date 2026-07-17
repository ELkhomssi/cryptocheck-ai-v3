import { redirect } from 'next/navigation'
import { requireOperatorPage } from '@/lib/operator/require-operator'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  await requireOperatorPage('/operator/subscriptions')
  redirect('/operator/subscriptions')
}
