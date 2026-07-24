import { NextResponse } from 'next/server'
import { getSmartMoneyFeed } from '@/lib/terminal/market-feeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/market/smart-money — trending enriched with smartMoneyScore mapping.
 * Never fabricates whale wallets.
 */
export async function GET() {
  const body = await getSmartMoneyFeed(20)
  return NextResponse.json(body)
}
