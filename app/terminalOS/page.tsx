'use client'

import { Suspense } from 'react'
import { TerminalOsShell } from '@/features/terminal-os/shell/components/TerminalOsShell'
import { NavDeepLink } from '@/features/terminal-os/shell/components/NavDeepLink'

/**
 * /terminalOS — canonical trading OS (Mission Control + AI Coach live here).
 * Protected by TerminalOsProviders (layout). No ModeRouter / Simple / Pro shell.
 */
export default function TerminalOsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <NavDeepLink />
      </Suspense>
      <TerminalOsShell />
    </>
  )
}
