import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { recordFeeRecord } from '@/lib/revenue-dashboard/fee-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/revenue/record-fee — persist FeeRecord after confirmed swap. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    signature?: string
    walletAddress?: string
    inputMint?: string
    outputMint?: string
    volumeUsd?: number
    feeBps?: number
    feeAmountBase?: string
    feeAmountUsd?: number
    feeTokenAccount?: string
  }

  const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
  const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
  const outputMint = typeof body.outputMint === 'string' ? body.outputMint.trim() : ''
  const inputMint = typeof body.inputMint === 'string' ? body.inputMint.trim() : ''

  if (!signature || signature.length < 64) {
    return NextResponse.json({ error: 'signature required' }, { status: 400, headers: gatewayResponseHeaders() })
  }
  if (!isValidSolanaMint(walletAddress) || !isValidSolanaMint(outputMint)) {
    return NextResponse.json({ error: 'Invalid wallet or mint' }, { status: 400, headers: gatewayResponseHeaders() })
  }

  const record = await recordFeeRecord({
    signature,
    walletAddress,
    inputMint: inputMint || 'So11111111111111111111111111111111111111112',
    outputMint,
    volumeUsd: Number.isFinite(Number(body.volumeUsd)) ? Math.max(0, Number(body.volumeUsd)) : 0,
    feeBps: Number.isFinite(Number(body.feeBps)) ? Number(body.feeBps) : 0,
    feeAmountBase: typeof body.feeAmountBase === 'string' ? body.feeAmountBase : '0',
    feeAmountUsd: Number.isFinite(Number(body.feeAmountUsd)) ? Number(body.feeAmountUsd) : undefined,
    feeTokenAccount: typeof body.feeTokenAccount === 'string' ? body.feeTokenAccount : '',
    executedAt: new Date().toISOString(),
    humanWalletHeuristic: 'unknown',
    ...(typeof (body as { signalId?: string }).signalId === 'string'
      ? { signalId: (body as { signalId: string }).signalId }
      : {}),
  })

  return NextResponse.json({ ok: true, record }, { status: 201, headers: gatewayResponseHeaders() })
}
