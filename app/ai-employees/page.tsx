'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { AiEmployeesPanel } from '@/components/portfolio-desk/agents/AiEmployeesPanel'
import { AlertsPanel } from '@/components/portfolio-desk/alerts/AlertsPanel'
import { CoachPanel } from '@/components/portfolio-desk/coach/CoachPanel'
import { Sidebar } from '@/components/portfolio-desk/layout/Sidebar'
import { PageHeader } from '@/components/portfolio-desk/layout/PageHeader'
import { TickerTape } from '@/components/portfolio-desk/layout/TickerTape'
import { Topbar } from '@/components/portfolio-desk/layout/Topbar'
import type { PortfolioAlert } from '@/types/portfolio-desk'
import { useRouter } from 'next/navigation'

/**
 * Dedicated /ai-employees route — same terminal shell, employees as primary view.
 * Sidebar nav routes other desk sections back to /terminal.
 */
export default function AiEmployeesPage() {
  const router = useRouter()
  const { walletAddress } = useSolana()
  const [mobileNav, setMobileNav] = useState(false)
  const alertsQ = useQuery({
    queryKey: ['portfolio-alerts-count', walletAddress],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/portfolio/alerts${q}`, { cache: 'no-store' })
      if (!res.ok) return 0
      const body = (await res.json()) as { alerts?: PortfolioAlert[] }
      return body.alerts?.length ?? 0
    },
    refetchInterval: 20_000,
    staleTime: 15_000,
  })

  return (
    <div className="pd-shell">
      {mobileNav ? (
        <button
          type="button"
          className="pd-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <Sidebar
        active="employees"
        onSelect={(id) => {
          if (id === 'employees') {
            setMobileNav(false)
            return
          }
          router.push(`/terminal?nav=${id}`)
        }}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />
      <Topbar alertCount={alertsQ.data ?? 0} onOpenNav={() => setMobileNav(true)} />
      <TickerTape />

      <main className="pd-main">
        <PageHeader
          kicker="// AI EMPLOYEES"
          title="AI Employees"
          subtitle="Specialized trading agents with live status and real performance scores."
        />
        <AiEmployeesPanel />
      </main>

      <aside className="pd-aside">
        <AlertsPanel />
        <CoachPanel />
      </aside>
    </div>
  )
}
