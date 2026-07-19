'use client'

import { YourSavesPanel } from '@/components/launchpad/YourSavesPanel'

export default function LaunchpadSavesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-rd-display text-lg font-bold uppercase tracking-wide text-rd-hi">
          Your Saves
        </h2>
        <p className="mt-1 text-sm text-rd-mid">
          Only real rugs create receipts. Save-rate includes non-saves. Loss avoided is an estimate.
        </p>
      </header>
      <YourSavesPanel />
    </div>
  )
}
