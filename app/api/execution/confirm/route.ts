import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidSolanaMint } from '@/lib/signal-aggregator/snipe-execution'
import { recordCapitalFill, execMetricInc, EXEC_METRICS } from '@/lib/execution'
import { finalizeAuditWithSignature } from '@/lib/execution/audit-store'
import type { OpportunityIntake } from '@/lib/execution'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/execution/confirm
 * Client calls AFTER wallet confirms on-chain. Updates OMS audit + capital book.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const opportunityId = String(body.opportunityId ?? '').trim()
  const mint = String(body.mint ?? '').trim()
  const walletAddress = String(body.walletAddress ?? body.userPublicKey ?? '').trim()
  const txSignature = String(body.txSignature ?? body.signature ?? '').trim()
  const amountSol = Number(body.amountSol)
  const realizedPnlSol = Number.isFinite(Number(body.realizedPnlSol))
    ? Number(body.realizedPnlSol)
    : 0

  if (!opportunityId || opportunityId.length < 8) {
    return NextResponse.json({ error: 'opportunityId required' }, { status: 400 })
  }
  if (!isValidSolanaMint(mint)) {
    return NextResponse.json({ error: 'valid mint required' }, { status: 400 })
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(txSignature)) {
    return NextResponse.json({ error: 'valid txSignature required' }, { status: 400 })
  }

  const ok = await finalizeAuditWithSignature({
    opportunityId,
    userId: user.id,
    signature: txSignature,
    realizedPnlSol,
  })

  if (Number.isFinite(amountSol) && amountSol > 0 && walletAddress) {
    const opp: OpportunityIntake = {
      opportunityId,
      source: 'api',
      userId: user.id,
      walletAddress,
      mint,
      chain: 'solana',
      side: 'buy',
      amountSol,
      strategy: 'balanced',
      maxSlippageBps: 100,
      createdAt: new Date().toISOString(),
    }
    await recordCapitalFill(opp, txSignature, realizedPnlSol).catch(() => undefined)
  }

  execMetricInc(EXEC_METRICS.fills, { ok: String(ok) })

  return NextResponse.json(
    { ok, opportunityId, signature: txSignature },
    { headers: { 'cache-control': 'no-store' } },
  )
}
