import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getDashboardUsageBundle } from '@/lib/services/usage-analytics.service'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { GlassCard } from '@/components/Dashboard/GlassCard'
import { RadialCapacity } from '@/components/Dashboard/RadialCapacity'
import { ActivityStream, type StreamEvent } from '@/components/Dashboard/ActivityStream'

export const dynamic = 'force-dynamic'

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [sub, usage] = await Promise.all([
    getUserSubscription(user.id),
    getDashboardUsageBundle(user.id, 7),
  ])

  const lastDays = usage.series.slice(-7)
  const analyses7d = lastDays.reduce((a, b) => a + b.count, 0)
  const sentinelMode = ['PRO', 'ENTERPRISE'].includes(sub.effectiveTier.toUpperCase())

  const sb = getSupabaseAdmin()
  const { data: recentRows } = await sb
    .from('security_logs')
    .select('id, action, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(14)

  const streamInitial: StreamEvent[] = (recentRows ?? []).map((r) => ({
    id: String(r.id),
    action: String(r.action),
    created_at: String(r.created_at),
  }))

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Intelligence command
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200 md:text-[1.65rem]">
          Institutional overview
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          Subscription, credentials, and intelligence throughput — SENTINEL-grade API control plane.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 grid gap-6 lg:col-span-8 lg:grid-cols-12">
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <GlassCard accent={sentinelMode ? 'sentinel' : 'default'} className="p-5">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">Deployment tier</p>
              <p className="mt-3 text-lg font-semibold tabular-nums text-slate-200">{sub.effectiveTier}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
                Governance, quotas, and SLAs follow this tier across all intelligence routes.
              </p>
              <Link
                href="/dashboard/billing"
                className="mt-4 inline-flex text-xs font-semibold tracking-wide text-cyan-400/90 transition-colors duration-150 hover:text-cyan-300"
              >
                Manage subscription →
              </Link>
            </GlassCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <GlassCard className="h-full p-5">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">
                Security analyses (7d)
              </p>
              <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-slate-200">
                {analyses7d.toLocaleString()}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-400">
                Completed intelligence cycles across your workspace — not raw traffic volume.
              </p>
              <Link
                href="/dashboard/usage"
                className="mt-4 inline-flex text-xs font-semibold tracking-wide text-slate-400 transition-colors duration-150 hover:text-slate-200"
              >
                Open intelligence ops →
              </Link>
            </GlassCard>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <GlassCard accent={sentinelMode ? 'sentinel' : 'default'} className="flex h-full flex-col p-5">
              <p className="text-center text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">
                System capacity
              </p>
              <p className="mt-1 text-center text-xs font-medium text-slate-400">
                Daily intelligence operations budget (UTC)
              </p>
              <div className="mt-2 flex flex-1 items-center justify-center">
                <RadialCapacity
                  used={usage.quota.used}
                  limit={usage.quota.limit}
                  label="Capacity utilization"
                  sublabel={`${usage.quota.used.toLocaleString()} of ${usage.quota.limit.toLocaleString()} operations`}
                />
              </div>
            </GlassCard>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <GlassCard className="flex h-full min-h-[280px] flex-col p-0">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Threat event stream
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">Live security log — Bloomberg-style feed</p>
            </div>
            <div className="flex-1 px-2 py-3">
              <ActivityStream initial={streamInitial} />
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/api-keys"
          className="inline-flex items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/95 shadow-[0_0_20px_rgba(16,185,129,0.08)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-emerald-500/15"
        >
          Issue API credential
        </Link>
        <Link
          href="/dashboard/compliance"
          className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition-all duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.05]"
        >
          Compliance &amp; exports
        </Link>
        <Link
          href="/api/docs"
          className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition-all duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.05]"
        >
          API reference
        </Link>
      </div>
    </div>
  )
}
