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
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">PRO Surface</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Portfolio intelligence</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          Batch risk scan holdings, export compliance CSV, and review recent snapshots.
        </p>
      </header>
      <PortfolioScanner audience="dashboard" initialTier={tier} initialHistory={(data ?? []) as SnapshotRow[]} />
    </div>
  )
}
