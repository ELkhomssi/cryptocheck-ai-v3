import { NextResponse } from 'next/server'
import { fetchProofCallById } from '@/lib/proof-engine/calls-store'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/** GET /api/proof/calls/[id] — public proof call (shareable). */
export async function GET(_req: Request, { params }: Params) {
  const call = await fetchProofCallById(params.id)
  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }
  return NextResponse.json({ call }, { headers: { 'cache-control': 'no-store' } })
}
