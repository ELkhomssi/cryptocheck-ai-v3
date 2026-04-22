import { NextResponse } from 'next/server'
import { getPublicStatusPayload } from '@/lib/status/public-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public status JSON — no authentication. Safe for status aggregators and `status.*` vanity hosts.
 */
export async function GET() {
  const payload = await getPublicStatusPayload()
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
    },
  })
}
