import { NextResponse } from 'next/server'
import { fetchWhaleFlowForMint } from '@/lib/services/whale/fetch-whale-flow'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { mint: string } }
) {
  try {
    const items = await fetchWhaleFlowForMint(params.mint, { hoursBack: 24, limit: 100 })
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[whale-flow]', err)
    return NextResponse.json({ items: [] }, { status: 200 })
  }
}
