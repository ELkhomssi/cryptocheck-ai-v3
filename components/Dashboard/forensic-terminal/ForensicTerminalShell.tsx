'use client'

import type { ReactNode } from 'react'
import { ForensicBackdrop } from '@/components/Dashboard/forensic-terminal/ForensicBackdrop'

type ForensicTerminalShellProps = {
  children: ReactNode
  bleed?: boolean
  maxWidthClass?: string
}

/**
 * Forensic command region: optional full-bleed vs embedded; shares {@link ForensicBackdrop} with dashboard shell.
 */
export function ForensicTerminalShell({
  children,
  bleed = true,
  maxWidthClass = 'max-w-[1200px]',
}: ForensicTerminalShellProps) {
  const outerBleed =
    'relative -mx-4 -my-8 min-h-[calc(100dvh-6rem)] overflow-hidden bg-[#020617] px-4 py-8 text-slate-100 md:-mx-8 md:px-8 md:-my-10 md:py-10'
  const outerEmbedded =
    'relative min-h-[calc(100dvh-5rem)] w-full overflow-hidden bg-[#020617] px-0 py-4 text-slate-100 sm:px-2 md:py-6'

  return (
    <div className={bleed ? outerBleed : outerEmbedded}>
      <ForensicBackdrop className="pointer-events-none absolute inset-0 z-0" />
      <div className={`relative z-[1] mx-auto w-full ${maxWidthClass}`}>{children}</div>
    </div>
  )
}
