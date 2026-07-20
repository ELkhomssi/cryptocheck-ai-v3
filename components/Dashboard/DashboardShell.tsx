'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { DesktopSidebar } from '@/components/Dashboard/DesktopSidebar'
import { MobileBottomNav } from '@/components/Dashboard/MobileBottomNav'
import { MobileDrawer } from '@/components/Dashboard/MobileDrawer'
import { MobileTopBar } from '@/components/Dashboard/MobileTopBar'
import { ForensicBackdrop } from '@/components/Dashboard/forensic-terminal/ForensicBackdrop'

type HealthPayload = {
  status?: string
  latency_ms?: number
}

export function DashboardShell({
  children,
  userEmail,
  effectiveTier,
  isAnonymousPreview = false,
}: {
  children: React.ReactNode
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}) {
  const pathname = usePathname()
  const isCommandCenterHome = pathname === '/dashboard'
  const isTradingTerminal = pathname === '/dashboard/terminal' || pathname.startsWith('/dashboard/terminal/')
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const poll = useCallback(async () => {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' })
      const j = (await r.json()) as HealthPayload
      setHealth(j)
    } catch {
      setHealth({ status: 'degraded' })
    }
  }, [])

  useEffect(() => {
    void poll()
    const id = window.setInterval(() => void poll(), 180000)
    return () => window.clearInterval(id)
  }, [poll])

  const operational = health?.status === 'healthy'

  // Overview `/dashboard` uses its own Trading Workspace chrome (DashboardNew).
  if (isCommandCenterHome) {
    return <>{children}</>
  }

  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-200">
      <ForensicBackdrop className="pointer-events-none fixed inset-0 z-[1] opacity-40" />

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-[#050505]/90 backdrop-blur-xl">
        {isAnonymousPreview && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-amber-500/20 bg-amber-950/80 px-3 py-1.5 font-mono text-[0.62rem] font-medium text-amber-100/95">
            <span>Preview</span>
            <a
              href="/landing?next=%2Fdashboard"
              className="rounded border border-amber-400/35 bg-amber-500/20 px-2 py-0.5 text-amber-50 hover:bg-amber-500/30"
            >
              Sign in
            </a>
          </div>
        )}
        <div className="flex min-h-12 items-center gap-3 px-3 md:h-11 md:px-6">
          <MobileTopBar onOpenMenu={() => setDrawerOpen(true)} />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                operational ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={operational ? 'Live' : 'Degraded'}
              aria-label={operational ? 'System live' : 'System degraded'}
            />
            <span className="truncate font-mono text-xs text-zinc-500">Trading workspace</span>
          </div>
          {userEmail ? (
            <span className="hidden max-w-[12rem] truncate font-mono text-[11px] text-zinc-500 sm:inline">
              {userEmail}
            </span>
          ) : null}
        </div>
      </header>

      <DesktopSidebar
        pathname={pathname}
        sentinelMode={false}
        userEmail={userEmail}
        isAnonymousPreview={isAnonymousPreview}
      />

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pathname={pathname} />

      <MobileBottomNav pathname={pathname} />

      <main
        className={`relative z-10 min-h-screen pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-10 md:pl-[260px] ${
          isAnonymousPreview ? 'pt-24 md:pt-20' : 'pt-12 md:pt-11'
        }`}
      >
        {isTradingTerminal ? (
          <div className="relative z-[2] h-full min-h-[calc(100vh-2.75rem)] overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="relative z-[2] mx-auto max-w-[1200px] px-4 py-8 md:px-8 md:py-10">
            {children}
          </div>
        )}
      </main>
    </div>
  )
}
