'use client'

import { Suspense } from 'react'
import { ModeRouter } from '@/features/attention-feed'

/**
 * CryptoCheck AI Operating System.
 * Intent gateway + Decision Engine briefing — not a crypto dashboard.
 */
export default function TerminalOsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: '#6b7380', fontFamily: 'var(--font-geist-sans), sans-serif' }}>
          Starting AI Operating System…
        </div>
      }
    >
      <ModeRouter />
    </Suspense>
  )
}
