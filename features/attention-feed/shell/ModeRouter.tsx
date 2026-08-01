'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { TerminalOsShell } from '@/features/terminal-os/shell/components/TerminalOsShell'
import { FloatingModeToggle } from '../components/FloatingModeToggle'
import { SimpleModeShell } from './SimpleModeShell'
import { usePresentationModeStore } from '../stores/presentation-mode'
import '../styles.css'

/**
 * Dual-mode router — additive wrapper.
 * Pro Mode shell is imported unchanged; never edited.
 * Dubai booth: ?mode=pro or ?demo=pro forces Pro on load.
 */
export function ModeRouter() {
  const searchParams = useSearchParams()
  const mode = usePresentationModeStore((s) => s.mode)
  const hydrated = usePresentationModeStore((s) => s.hydrated)
  const hydrate = usePresentationModeStore((s) => s.hydrate)

  useEffect(() => {
    hydrate(searchParams.toString())
  }, [hydrate, searchParams])

  if (!hydrated) {
    return (
      <div className="sm-boot" style={{ padding: 24, color: 'var(--tos-text-secondary, #9a9588)' }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      <FloatingModeToggle />
      {mode === 'simple' ? <SimpleModeShell /> : <TerminalOsShell />}
    </>
  )
}
