'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useSolana } from '@/components/SolanaProvider'
import { AiEmployeesPanel } from '@/components/portfolio-desk/agents/AiEmployeesPanel'
import { Sidebar } from '@/components/portfolio-desk/layout/Sidebar'
import { PageHeader } from '@/components/portfolio-desk/layout/PageHeader'
import { TickerTape } from '@/components/portfolio-desk/layout/TickerTape'
import { Topbar } from '@/components/portfolio-desk/layout/Topbar'
import { MissionFeedPanel } from '@/components/portfolio-desk/mission/MissionFeedPanel'
import { CoachPanel } from '@/components/portfolio-desk/coach/CoachPanel'
import type { PortfolioAlert } from '@/types/portfolio-desk'
import type { DeskNav } from '@/lib/portfolio-desk/nav'

/**
 * Settings → Intelligence Engine (Phase 15.1).
 * Full Phase 11 employee roster/orchestrator — not in primary nav.
 */
export default function IntelligenceEnginePage() {
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
        active="settings"
        onSelect={(id: DeskNav) => {
          setMobileNav(false)
          if (id === 'settings') {
            router.push('/terminal?nav=settings')
            return
          }
          if (id === 'intelligence') return
          router.push(`/terminal?nav=${id}`)
        }}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />
      <Topbar
        alertCount={alertsQ.data ?? 0}
        onOpenNav={() => setMobileNav(true)}
        onOpenFeed={() => router.push('/terminal?nav=feed')}
      />
      <TickerTape />

      <main className="pd-main">
        <PageHeader
          kicker="// INTELLIGENCE ENGINE"
          title="Intelligence Engine"
          subtitle="Advanced employee roster and orchestrator — relocated from primary navigation."
        />
        <AiEmployeesPanel />
      </main>

      <aside className="pd-aside">
        <MissionFeedPanel condensed limit={12} />
        <CoachPanel />
      </aside>
    </div>
  )
}
