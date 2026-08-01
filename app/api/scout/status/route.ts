import { NextResponse } from 'next/server'
import { loadScoutState } from '@/lib/scout/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/scout/status — Scout dashboard snapshot (read-only). */
export async function GET() {
  const state = await loadScoutState()
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
}
