import { NextResponse } from 'next/server'
import { buildTopTraders } from '@/lib/command-center/top-traders'

export const dynamic = 'force-dynamic'

/** GET /api/dashboard/command-center/top-traders — honest wallet leaderboard or SOON. */
export async function GET() {
  const result = await buildTopTraders()
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
}
