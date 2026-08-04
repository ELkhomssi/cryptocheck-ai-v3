'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { resolveTerminalOsNavParam } from '@/features/terminal-os/shell/lib/nav-deep-link'

/** Applies ?nav= (and legacy /terminal desk ids) once on mount / param change. */
export function NavDeepLink() {
  const searchParams = useSearchParams()
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)

  useEffect(() => {
    const nav = resolveTerminalOsNavParam(searchParams.get('nav'))
    if (nav) setActiveNav(nav)

    const mint = (searchParams.get('mint') || '').trim()
    if (mint) {
      setFocused({
        id: mint,
        symbol: (searchParams.get('symbol') || mint.slice(0, 6)).trim(),
        name: (searchParams.get('symbol') || mint.slice(0, 6)).trim(),
        chain: 'solana',
        priceUsd: 0,
        logoUrl: undefined,
      })
    }
  }, [searchParams, setActiveNav, setFocused])

  return null
}
