import 'server-only'
import { createClient } from '@supabase/supabase-js'

export type SmartMoneyWallet = {
  address: string
  label: string | null
  tier: 'whale' | 'smart_money' | 'insider'
  historicalPnlUsd: number
  winRatePct: number
}

export async function fetchSmartMoneyWallets(opts?: {
  minPnl?: number
  limit?: number
}): Promise<SmartMoneyWallet[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('smart_money_wallets')
    .select('*')
    .eq('active', true)
    .gte('historical_pnl_usd', opts?.minPnl ?? 50_000)
    .order('historical_pnl_usd', { ascending: false })
    .limit(opts?.limit ?? 100)

  if (error) {
    console.error('[smart-money] query failed:', error)
    return []
  }

  return (data ?? []).map((r) => ({
    address: r.address,
    label: r.label,
    tier: r.tier,
    historicalPnlUsd: Number(r.historical_pnl_usd),
    winRatePct: Number(r.win_rate_pct),
  }))
}
