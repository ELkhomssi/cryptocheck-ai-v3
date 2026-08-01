'use client'

import { Suspense } from 'react'
import { ModeRouter } from '@/features/attention-feed'

/**
 * Dual Mode entry — Simple (AI OS) vs Pro (Terminal).
 * The only Pro-adjacent change: route through ModeRouter.
 * TerminalOsShell itself is imported unchanged inside ModeRouter.
 */
export default function TerminalOsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: 'var(--tos-text-secondary, #57534e)' }}>
          Loading…
        </div>
      }
    >
      <ModeRouter />
    </Suspense>
  )
}
