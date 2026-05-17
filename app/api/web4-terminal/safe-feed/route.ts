import { NextResponse } from 'next/server'
import { getWeb4SafeFeed } from '@/lib/web4-terminal/market-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await getWeb4SafeFeed()
    return NextResponse.json({ items, updatedAt: new Date().toISOString() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Safe feed unavailable'
    return NextResponse.json({ error: message, items: [] }, { status: 502 })
  }
}
