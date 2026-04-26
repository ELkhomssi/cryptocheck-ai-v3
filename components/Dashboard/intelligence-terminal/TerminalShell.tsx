'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { TerminalGate } from './TerminalGate'
import { useTerminal } from './TerminalProvider'
import { Console } from './Console'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

function TerminalSkeleton() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
      <Loader2 className="h-10 w-10 motion-safe:animate-spin text-[#00d4aa]" aria-hidden />
      <span className="sr-only">Loading terminal</span>
    </div>
  )
}

/**
 * Analysis Console shell.
 *
 * When `unlockedChildren` is set: tools stay mounted; `TerminalGate` overlays only
 * after hydration completes without a verified session — no “restoring session” flash
 * while the key in `cryptocheck_access_key` is being verified.
 */
export function TerminalShell({ unlockedChildren }: { unlockedChildren?: ReactNode }) {
  const { state } = useTerminal()

  const hasValidKey = state.phase === 'unlocked' && state.key !== null

  if (unlockedChildren) {
    return (
      <div className="relative w-full">
        {unlockedChildren}

        {!state.hydrating && !hasValidKey ? (
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/88 backdrop-blur-md px-4 pb-16 pt-10 md:pt-14">
            <TerminalGate />
          </div>
        ) : null}
      </div>
    )
  }

  if (state.hydrating) {
    return <TerminalSkeleton />
  }

  return (
    <>
      <DisclaimerBanner variant="whale" />
      {state.phase === 'idle' || state.phase === 'locked' || state.phase === 'verifying' ? (
        <TerminalGate />
      ) : state.phase === 'unlocked' ? (
        <Console />
      ) : null}
    </>
  )
}
