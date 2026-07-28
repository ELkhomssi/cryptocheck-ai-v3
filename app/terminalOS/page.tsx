'use client'

import { Suspense } from 'react'
import { TerminalOsShell } from '@/features/terminal-os/shell/components/TerminalOsShell'

export default function TerminalOsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: 'var(--tos-text-secondary)' }}>
          Loading Terminal OS…
        </div>
      }
    >
      <TerminalOsShell />
    </Suspense>
  )
}
