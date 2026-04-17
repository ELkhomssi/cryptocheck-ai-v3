'use client'

import { Loader2 } from 'lucide-react'
import { TerminalGate } from './TerminalGate'
import { useTerminal } from './TerminalProvider'
import { PlaceholderConsole } from './PlaceholderConsole'

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

  if (state.phase === 'idle' || state.phase === 'locked' || state.phase === 'verifying') {
    return <TerminalGate />
  }

  if (state.phase === 'unlocked') {
    return <PlaceholderConsole />
  }

  return null
}
