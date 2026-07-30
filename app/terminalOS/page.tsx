'use client'

import { Suspense } from 'react'
import { ModeRouter } from '@/features/attention-feed'

/**
 * Terminal OS entry — dual presentation modes over the same engines.
 * Pro Mode shell is unchanged; Simple Mode is additive via ModeRouter.
 * Force Pro for Dubai: /terminalOS?mode=pro
 */
export default function TerminalOsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: 'var(--tos-text-secondary)' }}>
          Loading Terminal OS…
        </div>
      }
    >
      <ModeRouter />
    </Suspense>
  )
}
