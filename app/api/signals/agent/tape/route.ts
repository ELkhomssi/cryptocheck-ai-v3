import { NextRequest, NextResponse } from 'next/server'
import { AGENT_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { readAgentTape } from '@/lib/sentinel-edge/tape'

export const dynamic = 'force-dynamic'

/** GET /api/signals/agent/tape — live decision/settlement tape. */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)
  const tape = await readAgentTape(limit)
  return NextResponse.json({ tape, compliance: AGENT_COMPLIANCE })
}
