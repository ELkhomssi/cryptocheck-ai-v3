'use client'

/**
 * Portfolio desk theme hydrator only.
 * QueryClient lives once in app/providers.tsx — do not re-create it here.
 */

import { useEffect, type ReactNode } from 'react'
import { usePortfolioTheme } from '@/store/portfolio-theme'

function ThemeHydrator({ children }: { children: ReactNode }) {
  const hydrateDom = usePortfolioTheme((s) => s.hydrateDom)
  useEffect(() => {
    hydrateDom()
  }, [hydrateDom])
  return <>{children}</>
}

export function PortfolioProviders({ children }: { children: ReactNode }) {
  return <ThemeHydrator>{children}</ThemeHydrator>
}
