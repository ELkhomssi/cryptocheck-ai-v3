import { Suspense } from 'react'
import { MasterFeed } from '@/components/signals-dashboard/MasterFeed'

export default function SignalsFeedPage() {
  return (
    <Suspense fallback={<div className="rd-panel p-6 text-sm text-rd-mid">Loading feed…</div>}>
      <MasterFeed />
    </Suspense>
  )
}
