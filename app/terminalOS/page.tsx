'use client'

import { Suspense } from 'react'
import { ModeRouter } from '@/features/attention-feed'

/**
 * Terminal OS — single AI Operating System experience.
 * Legacy Pro chrome: ?legacy=pro
 */
export default function TerminalOsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: 'var(--tos-text-secondary, #9a9588)' }}>
          Loading…
        </div>
      }
    >
      <ModeRouter />
    </Suspense>
  )
}
