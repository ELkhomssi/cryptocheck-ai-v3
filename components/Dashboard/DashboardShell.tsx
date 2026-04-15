'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  Shield,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

type HealthPayload = {
  status?: string
  latency_ms?: number
}

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/api-keys', label: 'Credentials', icon: KeyRound },
  { href: '/dashboard/usage', label: 'Intelligence Ops', icon: BarChart3 },
  { href: '/dashboard/security', label: 'SENTINEL', icon: Shield },
  { href: '/dashboard/billing', label: 'Subscription', icon: CreditCard },
] as const

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
}: {
  children: React.ReactNode
  userEmail: string
  effectiveTier: string
}) {
  const pathname = usePathname()
  const [health, setHealth] = useState<HealthPayload | null>(null)
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
    <div className="min-h-screen bg-[#050506] text-slate-200">
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
        className={`fixed left-0 right-0 z-50 border-b border-white/[0.06] bg-[rgba(8,8,9,0.85)] backdrop-blur-xl ${
          sentinelMode ? 'top-8' : 'top-0'
        }`}
      >
        <div className="flex h-10 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-[0.68rem] font-medium tracking-wide text-slate-400">
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

      <aside
        className={`fixed bottom-0 left-0 z-40 flex w-[300px] flex-col border-r border-white/[0.06] bg-[rgba(7,7,8,0.92)] backdrop-blur-[20px] ${
          sentinelMode ? 'top-[4.5rem]' : 'top-10'
        }`}
      >
        <div className="border-b border-white/[0.05] px-5 py-6">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Control plane</p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-slate-200">CryptoCheck AI</p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-slate-500">Intelligence operations</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.72rem] font-medium tracking-wide transition-colors duration-150 ease-out ${
                  active
                    ? 'bg-white/[0.06] text-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                {active && (
                  <span
                    className={`absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b ${
                      sentinelMode ? 'from-emerald-400 to-cyan-400' : 'from-slate-400 to-slate-600'
                    } shadow-[0_0_12px_rgba(52,211,153,0.35)]`}
                  />
                )}
                <Icon
                  className={`h-4 w-4 shrink-0 transition-transform duration-150 ease-out group-hover:scale-[1.03] ${
                    active ? 'text-slate-100' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                  strokeWidth={1.35}
                />
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]">{label}</span>
                {active && (
                  <span className="pointer-events-none absolute inset-x-2 bottom-1 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent opacity-90" />
                )}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/[0.05] px-4 py-4">
          <p className="truncate text-[0.65rem] font-medium tracking-wide text-slate-500">{userEmail}</p>
        </div>
      </aside>

      <main
        className={`min-h-screen pl-[300px] ${sentinelMode ? 'pt-[4.5rem]' : 'pt-10'}`}
      >
        <div className="relative mx-auto max-w-[1200px] px-6 py-9 md:px-8 md:py-10">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(16,185,129,0.06), transparent)',
            }}
          />
          {children}
        </div>
      </main>
    </div>
  )
}
