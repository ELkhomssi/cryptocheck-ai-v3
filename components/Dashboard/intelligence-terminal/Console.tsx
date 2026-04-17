'use client'

/**
 * Console — Phase 4B
 *
 * Top-level Analysis Console layout. Composes:
 *   • BackgroundLayer    (fixed, -z-30..-z-10, decorative)
 *   • Glass-morphism container with cyan edge glow
 *   • ConsoleHeader      (status, masked key, actions)
 *   • CommandLineInput   (terminal prompt)
 *   • ScanResultSurface  (empty / loading / populated)
 *
 * Renders only when `state.phase === 'unlocked'` and `state.key` is
 * present — TerminalShell gates this upstream.
 */

import { useConsoleShortcuts } from './hooks/useConsoleShortcuts'
import { useTerminal } from './TerminalProvider'
import { BackgroundLayer } from './shell/BackgroundLayer'
import { ConsoleHeader } from './shell/ConsoleHeader'
import { CommandLineInput } from './shell/CommandLineInput'
import { ScanResultSurface } from './shell/ScanResultSurface'

export function Console() {
  const { state } = useTerminal()
  useConsoleShortcuts()
  if (!state.key) return null

  return (
    <div className="relative min-h-screen overflow-hidden font-mono-terminal">
      <BackgroundLayer />

      <main className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
        <section
          className="
            relative rounded-2xl border border-white/5
            bg-[#0b1220]/60 p-5 shadow-[0_0_40px_rgba(0,212,170,0.08),0_0_80px_rgba(0,212,170,0.04)] backdrop-blur-2xl
            md:p-10
          "
        >
          {/* Inner highlight along the top edge — gives the 'gradient border' feel. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00d4aa]/30 to-transparent"
          />

          <ConsoleHeader />
          <CommandLineInput />
          <ScanResultSurface />
        </section>
      </main>
    </div>
  )
}
