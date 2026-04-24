'use client'

import { Loader2 } from 'lucide-react'
import { TerminalGate } from './TerminalGate'
import { useTerminal } from './TerminalProvider'
import { Console } from './Console'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

function TerminalSkeleton() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
      <Loader2
        className="h-10 w-10 motion-safe:animate-spin text-[#00d4aa]"
        aria-hidden
      />
      <span className="sr-only">Loading terminal</span>
    </div>
  )
}

export function TerminalShell() {
  const { state } = useTerminal()

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
