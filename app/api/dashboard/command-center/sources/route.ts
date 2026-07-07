import { NextResponse } from 'next/server'
import { buildDataSourceStatusLive } from '@/lib/command-center/sources'

export const dynamic = 'force-dynamic'

/** GET /api/dashboard/command-center/sources — live vs SOON data source chips. */
export async function GET() {
  const txoddsLive = process.env.TXODDS_ENABLED === 'true' || Boolean(process.env.TXODDS_API_KEY?.trim())
  const status = await buildDataSourceStatusLive(txoddsLive)
  return NextResponse.json(status, {
    headers: { 'cache-control': 'no-store' },
  })
}
