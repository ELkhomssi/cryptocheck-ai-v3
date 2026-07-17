import { requireOperatorPage } from '@/lib/operator/require-operator'
import { LaunchOpsView } from '@/components/operator/views/launch-ops'

export const dynamic = 'force-dynamic'

export default async function OperatorLaunchPage() {
  await requireOperatorPage('/operator/launch')
  return <LaunchOpsView />
}
