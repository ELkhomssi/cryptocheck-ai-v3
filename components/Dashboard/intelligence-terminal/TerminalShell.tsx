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
 * When `unlockedChildren` is set (dashboard intelligence route): the original tools
 * stay mounted; a session overlay shows TerminalGate until `phase === 'unlocked'`
 * with a verified key — no replacement of the tool grid.
 *
 * Without children: legacy full-page neural `Console` + gate (extension / standalone).
 */
export function TerminalShell({ unlockedChildren }: { unlockedChildren?: ReactNode }) {
  const { state } = useTerminal()

  const hasValidKey = state.phase === 'unlocked' && state.key !== null

  if (unlockedChildren) {
    return (
      <div className="relative w-full">
        {unlockedChildren}

        {state.hydrating ? (
          <div
            aria-busy="true"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-slate-900/90 px-8 py-6 shadow-xl">
              <Loader2 className="h-9 w-9 motion-safe:animate-spin text-[#00d4aa]" aria-hidden />
              <p className="font-mono-terminal text-xs uppercase tracking-widest text-slate-400">Restoring session</p>
            </div>
          </div>
        ) : null}

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
