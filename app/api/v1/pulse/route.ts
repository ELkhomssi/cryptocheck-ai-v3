import { NextResponse } from 'next/server'
import { getPulseFeed } from '@/lib/services/pulse-feed.service'

export const dynamic = 'force-dynamic'

/** Global Pulse — last institutional-grade scans (Redis-backed with demo fallback). */
export async function GET() {
  const feed = await getPulseFeed()
  return NextResponse.json({ feed })
}
