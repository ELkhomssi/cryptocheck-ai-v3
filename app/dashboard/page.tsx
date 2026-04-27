import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import { getCachedDashboardUsageBundle, getCachedRecentSecurityRows } from '@/lib/services/dashboard-home-cache'
import { RadialCapacity } from '@/components/Dashboard/RadialCapacity'
import { ActivityStream, type StreamEvent } from '@/components/Dashboard/ActivityStream'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'

export const dynamic = 'force-dynamic'

function CyberLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'ghost'
}) {
  const base =
    'inline-flex items-center justify-center rounded-xl border px-5 py-2.5 font-space text-sm font-bold uppercase tracking-[0.14em] transition-all duration-200 ease-out hover:-translate-y-0.5'
  if (variant === 'primary') {
    return (
      <Link
        href={href}
        className={`${base} border-cyan-400/35 bg-gradient-to-r from-cyan-500/20 to-emerald-500/15 text-cyan-100 shadow-[0_0_22px_rgba(6,182,212,0.15)] hover:border-cyan-300/50 hover:shadow-[0_0_28px_rgba(6,182,212,0.25)]`}
      >
        {children}
      </Link>
    )
  }
  return (
    <Link
      href={href}
      className={`${base} border-white/[0.1] bg-white/[0.04] text-slate-200 hover:border-cyan-400/25 hover:bg-cyan-500/[0.06] hover:text-cyan-50`}
    >
      {children}
    </Link>
  )
}

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <header className="max-w-3xl">
          <p className="font-space text-xs font-bold uppercase tracking-[0.22em] text-amber-400/90">Preview</p>
          <h1 className="mt-2 font-space text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
            Intelligence command
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Browse the full dashboard UI without signing in. Connect your account when you are ready for live quotas,
            credentials, and SENTINEL logs.
          </p>
        </header>

        <div className="mt-8 flex flex-wrap gap-3">
          <CyberLink href="/landing?next=%2Fdashboard" variant="primary">
            Sign in
          </CyberLink>
          <CyberLink href="/dashboard/security">API keys — SENTINEL</CyberLink>
          <CyberLink href="/dashboard/intelligence-terminal">Terminal</CyberLink>
          <CyberLink href="/dashboard/compliance">Compliance</CyberLink>
          <CyberLink href="/dashboard/batch">Batch</CyberLink>
        </div>
      </>
    )
  }

  const [sub, usage] = await Promise.all([
    getUserSubscription(user.id),
    getCachedDashboardUsageBundle(user.id, 7),
  ])

  const lastDays = usage.series.slice(-7)
  const analyses7d = lastDays.reduce((a, b) => a + b.count, 0)
  const sentinelMode = ['PRO', 'ENTERPRISE'].includes(sub.effectiveTier.toUpperCase())

  const streamInitial: StreamEvent[] = await getCachedRecentSecurityRows(user.id)

  return (
    <>
      <header className="max-w-3xl">
        <p className="font-space text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/90">
          Intelligence command
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-emerald-200 bg-clip-text font-space text-3xl font-bold tracking-tight text-transparent md:text-4xl">
          Institutional overview
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          Subscription, credentials, and intelligence throughput — SENTINEL-grade API control plane.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6 lg:col-span-8">
          <NeonForensicPanel
            title="Analyse console"
            subtitle="High-resolution workspace telemetry · UTC intelligence window"
            tone="neutral"
          >
            <div className="rounded-xl border border-cyan-500/15 bg-slate-950/70 p-4 font-mono-terminal text-[0.7rem] leading-relaxed text-cyan-100/90">
              <p className="text-cyan-400/80">&gt; SESSION</p>
              <p className="mt-1 text-slate-300">
                organisation=<span className="text-emerald-300/90">authenticated</span> tier=
                <span className="text-cyan-200">{sub.effectiveTier}</span>
              </p>
              <p className="mt-3 text-cyan-400/80">&gt; QUOTA_WINDOW</p>
              <p className="mt-1 text-slate-300">
                analyses_7d=<span className="tabular-nums text-amber-200/90">{analyses7d.toLocaleString()}</span> sentinel_mode=
                <span className={sentinelMode ? 'text-emerald-300' : 'text-slate-500'}>
                  {sentinelMode ? 'armed' : 'standard'}
                </span>
              </p>
              <p className="mt-3 text-cyan-400/80">&gt; CAPACITY</p>
              <p className="mt-1 text-slate-300">
                used=<span className="tabular-nums text-cyan-200">{usage.quota.used.toLocaleString()}</span> limit=
                <span className="tabular-nums text-cyan-200">{usage.quota.limit.toLocaleString()}</span> window=
                <span className="text-fuchsia-200/80">UTC</span>
              </p>
            </div>
          </NeonForensicPanel>

          <div className="grid gap-6 sm:grid-cols-2">
            <NeonForensicPanel title="Deployment tier" subtitle="Billing & governance plane" tone="neutral">
              <p className="font-mono-terminal text-lg font-semibold tabular-nums text-cyan-100">{sub.effectiveTier}</p>
              <p className="mt-2 font-mono-terminal text-[0.65rem] font-medium leading-relaxed text-slate-400">
                Governance, quotas, and SLAs follow this tier across all intelligence routes.
              </p>
              <Link
                href="/dashboard/billing"
                className="mt-3 inline-flex font-mono-terminal text-xs font-semibold tracking-wide text-cyan-400/90 transition-colors hover:text-cyan-300"
              >
                manage_subscription →
              </Link>
            </NeonForensicPanel>

            <NeonForensicPanel title="Security analyses (7d)" subtitle="Completed intelligence cycles" tone="neutral">
              <p className="font-mono-terminal text-2xl font-semibold tabular-nums tracking-tight text-cyan-100">
                {analyses7d.toLocaleString()}
              </p>
              <p className="mt-2 font-mono-terminal text-[0.65rem] font-medium text-slate-400">
                Completed intelligence cycles across your workspace — not raw traffic volume.
              </p>
              <Link
                href="/dashboard/usage"
                className="mt-3 inline-flex font-mono-terminal text-xs font-semibold tracking-wide text-cyan-300/80 transition-colors hover:text-cyan-200"
              >
                open_intelligence_ops →
              </Link>
            </NeonForensicPanel>
          </div>

          <NeonForensicPanel
            title="Capacity utilization"
            subtitle="Daily intelligence operations budget (UTC)"
            tone="capacity"
          >
            <div className="flex justify-center py-2">
              <RadialCapacity
                used={usage.quota.used}
                limit={usage.quota.limit}
                sublabel={`${usage.quota.used.toLocaleString()} of ${usage.quota.limit.toLocaleString()} operations`}
                chartId="dash-main"
              />
            </div>
          </NeonForensicPanel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <NeonForensicPanel
            title="Threat event stream"
            subtitle="Forensic security log · immutable audit trail"
            tone="threat"
            className="min-h-[320px]"
          >
            <ActivityStream initial={streamInitial} variant="forensic" />
          </NeonForensicPanel>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <CyberLink href="/dashboard/api-keys" variant="primary">
          Issue API credential
        </CyberLink>
        <CyberLink href="/dashboard/compliance">Compliance &amp; exports</CyberLink>
        <CyberLink href="/api/docs">API reference</CyberLink>
        <CyberLink href="/dashboard/investigate">AI investigation</CyberLink>
      </div>
    </>
  )
}
