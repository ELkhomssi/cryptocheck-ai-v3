import { NextResponse } from 'next/server'
import { getSlot } from '@/lib/helius-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const slot = await getSlot()
    return NextResponse.json({ slot })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Slot fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
