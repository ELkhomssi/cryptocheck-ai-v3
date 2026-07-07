import { NextResponse } from 'next/server'
import { buildProofTrackRecord } from '@/lib/proof-engine/calls-store'

export const dynamic = 'force-dynamic'

/** GET /api/proof/calls — verified track record for dashboard. */
export async function GET() {
  const record = await buildProofTrackRecord(15)
  return NextResponse.json(record, { headers: { 'cache-control': 'no-store' } })
}
