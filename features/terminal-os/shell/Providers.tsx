'use client'

/**
 * Terminal OS layout shell passthrough.
 * QueryClient lives once in app/providers.tsx — do not re-create it here.
 */

import type { ReactNode } from 'react'

export function TerminalOsProviders({ children }: { children: ReactNode }) {
  return <>{children}</>
}
