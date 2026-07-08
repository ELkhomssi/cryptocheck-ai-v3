import { Suspense } from 'react'
import { MasterFeed } from '@/components/signals-dashboard/MasterFeed'
import { SniperPanel } from '@/components/dash-home/SniperPanel'

export default function SignalsFeedPage() {
  return (
    <div className="space-y-6">
      <SniperPanel />
      <Suspense fallback={<div className="rd-panel p-6 text-sm text-rd-mid">Loading feed…</div>}>
        <MasterFeed />
      </Suspense>
    </div>
  )
}
