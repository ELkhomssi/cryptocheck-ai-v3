import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveConsumerTier } from '@/lib/billing/consumer-tier'
import PortfolioScanner from '@/components/portfolio/PortfolioScanner'

export const dynamic = 'force-dynamic'

type SnapshotRow = {
  id: string
  scanned_at: string
  wallet_address: string
  total_tokens: number | null
  total_value_usd: number | null
  risky_tokens_count: number | null
}

export default async function DashboardPortfolioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const sb = getSupabaseAdmin()
  const [tier, { data }] = await Promise.all([
    resolveConsumerTier(user.id),
    sb
      .from('portfolio_snapshots')
      .select('id, scanned_at, wallet_address, total_tokens, total_value_usd, risky_tokens_count')
      .eq('user_id', user.id)
      .order('scanned_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="font-space text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-300/80">PRO Surface</p>
        <h1 className="mt-2 font-space text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
          Portfolio intelligence
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          Batch risk scan holdings, export compliance CSV, and review recent snapshots.
        </p>
      </header>
      <PortfolioScanner audience="dashboard" initialTier={tier} initialHistory={(data ?? []) as SnapshotRow[]} />
    </div>
  )
}
