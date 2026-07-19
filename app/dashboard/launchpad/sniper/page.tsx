'use client'

import { SniperPanel } from '@/components/dash-home/SniperPanel'
import { LAUNCHPAD_FEE_NOTE } from '@/lib/launchpad/constants'

export default function LaunchpadSniperPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-rd-display text-lg font-bold uppercase tracking-wide text-rd-hi">
          Verified sniper
        </h2>
        <p className="mt-1 text-sm text-rd-mid">
          Cache-hit path skips scan wait. DANGER still hard-blocks. {LAUNCHPAD_FEE_NOTE}
        </p>
      </header>
      <div className="rounded-rd-sm border border-white/10 bg-rd-navy2/50 p-3 [&_.dash-glass]:border-0 [&_.text-dash-thi]:text-rd-hi">
        <SniperPanel />
      </div>
    </div>
  )
}
