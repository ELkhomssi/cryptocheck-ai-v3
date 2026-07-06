import { NextRequest, NextResponse } from 'next/server'
import { AGENT_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { verifyCommitmentHash } from '@/lib/sentinel-edge/verify'

export const dynamic = 'force-dynamic'

/** POST /api/signals/agent/verify — re-hash check against proof index. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    commitmentHash?: string
    decisionId?: string
  }

  let hash = typeof body.commitmentHash === 'string' ? body.commitmentHash.trim() : ''

  if (!hash && body.decisionId) {
    // Resolve via proof index alias
    const { getAgentRedis } = await import('@/lib/sentinel-edge/redis')
    const { SIGNAL_PROOF_INDEX_PREFIX } = await import('@cryptocheck/signal-contracts')
    const redis = getAgentRedis()
    if (redis) {
      const h = await redis.get<string>(`${SIGNAL_PROOF_INDEX_PREFIX}dec:${body.decisionId}`)
      if (typeof h === 'string') hash = h
    }
  }

  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return NextResponse.json({ error: 'commitmentHash required' }, { status: 400 })
  }

  const result = await verifyCommitmentHash(hash.toLowerCase())
  return NextResponse.json({ result, compliance: AGENT_COMPLIANCE })
}
