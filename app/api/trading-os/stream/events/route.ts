import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TradingOsPortfolioSnapshot, TradingOsStreamEventsResponse } from '@/lib/trading-os/stream-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Authenticated trading stream tick: latest portfolio rows (RLS-scoped).
 * Poll interval is enforced client-side (~5s); this handler is stateless per request.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('trading_os_portfolios')
    .select('id,user_id,mint,entry_price_usd,amount_ui,meta,updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: 500 }
    )
  }

  const portfolios = (data ?? []) as TradingOsPortfolioSnapshot[]
  const body: TradingOsStreamEventsResponse = {
    ok: true,
    serverTime: new Date().toISOString(),
    portfolios,
  }
  return NextResponse.json(body)
}
