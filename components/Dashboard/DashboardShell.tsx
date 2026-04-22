'use client'

import { Activity, Shield } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { DesktopSidebar } from '@/components/Dashboard/DesktopSidebar'
import { MobileBottomNav } from '@/components/Dashboard/MobileBottomNav'
import { MobileDrawer } from '@/components/Dashboard/MobileDrawer'
import { MobileTopBar } from '@/components/Dashboard/MobileTopBar'

type HealthPayload = {
  status?: string
  latency_ms?: number
}

function tierLabel(t: string): string {
  const u = t.toUpperCase()
  if (u === 'FREE') return 'FREE'
  if (u === 'PRO') return 'PRO'
  if (u === 'ENTERPRISE') return 'ENTERPRISE'
  return u
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
  /** Logged-out preview: full dashboard chrome for QA without Supabase session. */
  isAnonymousPreview?: boolean
}) {
  const pathname = usePathname()
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sentinelMode = ['PRO', 'ENTERPRISE'].includes(effectiveTier.toUpperCase())

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
    const id = window.setInterval(() => void poll(), 30000)
    return () => window.clearInterval(id)
  }, [poll])

  const operational = health?.status === 'healthy'
  const latency = typeof health?.latency_ms === 'number' ? Math.round(health.latency_ms) : '—'

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200">
      {sentinelMode && (
        <div className="fixed left-0 right-0 top-0 z-[60] flex h-8 items-center justify-center gap-2 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-950/90 via-[rgba(10,10,11,0.95)] to-cyan-950/80 px-4 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-emerald-200/95 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Active protection mode — SENTINEL intelligence online
        </div>
      )}

      <header
        className={`fixed left-0 right-0 z-50 border-b border-white/[0.06] bg-[rgba(8,10,18,0.88)] backdrop-blur-xl ${
          sentinelMode ? 'top-8' : 'top-0'
        }`}
      >
        {isAnonymousPreview && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-amber-500/20 bg-amber-950/85 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-amber-100/95">
            <span>Preview</span>
            <span className="hidden font-medium normal-case tracking-normal text-amber-100/80 sm:inline">
              Sign in for live keys, quotas, and SENTINEL logs.
            </span>
            <a
              href="/landing?next=%2Fdashboard"
              className="rounded border border-amber-400/35 bg-amber-500/20 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-amber-50 hover:bg-amber-500/30"
            >
              Sign in
            </a>
          </div>
        )}
        <div className="flex min-h-12 items-center gap-2 px-3 py-1 md:h-10 md:min-h-[2.5rem] md:gap-4 md:px-6 md:py-0">
          <MobileTopBar onOpenMenu={() => setDrawerOpen(true)} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] font-medium tracking-wide text-slate-400 md:gap-x-5">
            <span className="inline-flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${operational ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-amber-400'}`}
              />
              <span className="text-slate-500">System</span>
              <span className="font-semibold text-slate-200">{operational ? 'Operational' : 'Degraded'}</span>
            </span>
            <span className="hidden h-3 w-px bg-white/10 sm:inline" />
            <span>
              <span className="text-slate-500">Latency</span>{' '}
              <span className="tabular-nums text-slate-200">{latency} ms</span>
            </span>
            <span className="hidden h-3 w-px bg-white/10 md:inline" />
            <span className="hidden md:inline">
              <span className="text-slate-500">Tier</span>{' '}
              <span className="font-semibold text-slate-200">{tierLabel(effectiveTier)}</span>
            </span>
            <span className="hidden h-3 w-px bg-white/10 lg:inline" />
            <span className="hidden items-center gap-1.5 lg:inline-flex">
              <Shield className="h-3.5 w-3.5 text-cyan-400/80" strokeWidth={1.5} />
              <span className="text-slate-500">Security</span>
              <span className="font-semibold tracking-wide text-cyan-200/90">SENTINEL ACTIVE</span>
            </span>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Activity className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.5} />
            <span className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-slate-500">Live</span>
          </div>
        </div>
      </header>

      <DesktopSidebar
        pathname={pathname}
        sentinelMode={sentinelMode}
        userEmail={userEmail}
        isAnonymousPreview={isAnonymousPreview}
      />

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pathname={pathname} />

      <MobileBottomNav pathname={pathname} />

      <main
        className={`min-h-screen pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-10 md:pl-[280px] ${
          sentinelMode ? 'pt-[5rem] md:pt-[4.5rem]' : isAnonymousPreview ? 'pt-28 md:pt-24' : 'pt-12 md:pt-10'
        }`}
      >
        <div className="relative mx-auto max-w-[1200px] px-4 py-8 md:px-8 md:py-10">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(0,212,170,0.06), transparent)',
            }}
          />
          {children}
        </div>
      </main>
    </div>
  )
}
