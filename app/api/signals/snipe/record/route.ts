import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { requireSessionFullAccess } from '@/lib/middleware/require-full-access'
import { isValidSolanaMint, logSnipeAction } from '@/lib/signal-aggregator/snipe-execution'

export const dynamic = 'force-dynamic'

/**
 * POST /api/signals/snipe/record
 * Client calls this AFTER the wallet confirms a swap on-chain, to write the
 * verifiable record (action='swap' + tx signature) to signal_snipe_actions.
 *
 * Body: { mint, txSignature, signalId?, symbol?, neuralScore?, verdict? }
 */
export async function POST(req: Request) {
  const gate = await requireSessionFullAccess()
  if (!gate.ok) return (gate as { response: NextResponse }).response

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const mint = String(body.mint ?? '').trim()
  const txSignature = String(body.txSignature ?? '').trim()
  const signalId = typeof body.signalId === 'string' ? body.signalId : mint
  const symbol = typeof body.symbol === 'string' ? body.symbol : mint.slice(0, 6)
  const neuralScore = Number.isFinite(Number(body.neuralScore)) ? Number(body.neuralScore) : 0
  const verdict = typeof body.verdict === 'string' ? body.verdict : 'SAFE'

  if (!isValidSolanaMint(mint)) {
    return NextResponse.json({ error: 'valid mint required' }, { status: 400 })
  }
  // Solana signatures are base58, ~87-88 chars.
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(txSignature)) {
    return NextResponse.json({ error: 'valid txSignature required' }, { status: 400 })
  }

  const ok = await logSnipeAction({
    id: crypto.randomUUID(),
    userId: gate.userId,
    signalId,
    mint,
    symbol,
    action: 'swap',
    allowed: true,
    neuralScore,
    verdict,
    redFlags: [],
    evidenceSummary: `Swap confirmed on-chain (${txSignature.slice(0, 8)}…)`,
    txSignature,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok, compliance: SIGNAL_COMPLIANCE }, { headers: { 'cache-control': 'no-store' } })
}
