import { NextRequest, NextResponse } from 'next/server'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { gatewayVerdictToSentinel } from '@/lib/signal-aggregator/constants'
import type { SignalChain } from '@cryptocheck/signal-contracts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function assertWorkerAuth(req: NextRequest): boolean {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  return Boolean(secret && header === secret)
}

function isSolanaMint(ca: string): boolean {
  return ca.length >= 32 && ca.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(ca)
}

function isEvmAddress(ca: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(ca)
}

function validateAddress(chain: SignalChain, ca: string): boolean {
  if (chain === 'solana') return isSolanaMint(ca)
  return isEvmAddress(ca)
}

/**
 * POST /api/internal/signals/assess
 * Worker-only: resolve CA + Sentinel gate via scan gateway (never touches frozen core directly).
 */
export async function POST(req: NextRequest) {
  if (!assertWorkerAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    chain?: SignalChain
    contractAddress?: string
  }

  const chain = body.chain ?? 'solana'
  const contractAddress = typeof body.contractAddress === 'string' ? body.contractAddress.trim() : ''

  if (!contractAddress || !validateAddress(chain, contractAddress)) {
    return NextResponse.json(
      { resolved: false, dropped: true, dropReason: 'Invalid contract address format' },
      { status: 200 },
    )
  }

  if (chain !== 'solana') {
    return NextResponse.json(
      {
        resolved: false,
        dropped: true,
        dropReason: 'On-chain resolve for this chain is not available in MVP (Solana scanner only)',
      },
      { status: 200 },
    )
  }

  try {
    const assessment = await assessRiskByMint(contractAddress, 'solana', 'fast')
    if (assessment.enrichmentFailed) {
      return NextResponse.json(
        {
          resolved: false,
          dropped: true,
          dropReason: 'Token could not be resolved on-chain',
        },
        { status: 200 },
      )
    }

    return NextResponse.json({
      resolved: true,
      dropped: false,
      sentinelVerdict: gatewayVerdictToSentinel(assessment.verdict),
      neuralScore: assessment.safetyScore,
      riskScore: assessment.riskScore,
      gatewayVerdict: assessment.verdict,
      cache: assessment.cache,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Assessment failed'
    return NextResponse.json(
      { resolved: false, dropped: true, dropReason: message },
      { status: 200 },
    )
  }
}
