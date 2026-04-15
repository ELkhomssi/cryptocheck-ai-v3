import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import { getDashboardUsageBundle } from '@/lib/services/usage-analytics.service'

export const dynamic = 'force-dynamic'

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const sub = await getUserSubscription(user.id)
  const usage = await getDashboardUsageBundle(user.id, 7)
  const lastDays = usage.series.slice(-7)
  const requests7d = lastDays.reduce((a, b) => a + b.count, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-white">Developer overview</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Subscription, keys, and usage — SENTINEL API platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Plan</p>
          <p className="mt-2 font-mono text-lg text-white">{sub.effectiveTier}</p>
          <Link href="/dashboard/billing" className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
            Manage billing →
          </Link>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Requests (7d)</p>
          <p className="mt-2 font-mono text-lg text-white">{requests7d}</p>
          <Link href="/dashboard/usage" className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
            View analytics →
          </Link>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Daily quota</p>
          <p className="mt-2 font-mono text-lg text-white">
            {usage.quota.used} / {usage.quota.limit}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500/80"
              style={{ width: `${Math.min(100, (usage.quota.used / Math.max(1, usage.quota.limit)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/api-keys"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15"
        >
          Create API key
        </Link>
        <Link
          href="/api/docs"
          className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04]"
        >
          API docs
        </Link>
      </div>
    </div>
  )
}
