'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { usePortfolioTheme } from '@/store/portfolio-theme'

function ThemeHydrator({ children }: { children: ReactNode }) {
  const hydrateDom = usePortfolioTheme((s) => s.hydrateDom)
  useEffect(() => {
    hydrateDom()
  }, [hydrateDom])
  return <>{children}</>
}

export function PortfolioProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <ThemeHydrator>{children}</ThemeHydrator>
    </QueryClientProvider>
  )
}
