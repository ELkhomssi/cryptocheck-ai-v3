import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidSolanaMint } from '@/lib/signal-aggregator/snipe-execution'
import {
  prepareExecution,
  execMetricInc,
  execMetricObserve,
  EXEC_METRICS,
  type ExecutionStrategyMode,
  type OpportunityIntake,
  type OpportunitySource,
} from '@/lib/execution'
import {
  insertOpportunity,
  insertAuditFromPrepare,
  preparedToAuditStatus,
} from '@/lib/execution/audit-store'
import { computePlatformFeeDisclosure } from '@/lib/launchpad/platform-fee'
import { SOL_MINT, getPlatformFeeBps, isPlatformFeeConfigured } from '@/lib/trading/platform-fee-config'
import { resolvePlatformFeeAccountForMint } from '@/lib/trading/platform-fee-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STRATEGIES = new Set<ExecutionStrategyMode>([
  'aggressive',
  'balanced',
  'conservative',
  'post_dump_entry',
  'liquidity_confirmation',
  'smart_entry',
])

const SOURCES = new Set<OpportunitySource>([
  'launchlab',
  'smart_alpha',
  'sniper',
  'manual',
  'api',
  'guardian_exit',
])

/**
 * POST /api/execution/prepare
 * Institutional OMS prepare — returns UNSIGNED Jupiter tx when allowed.
 * Never signs. Critical risk never executable.
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const mint = String(body.mint ?? '').trim()
  const walletAddress = String(body.walletAddress ?? body.userPublicKey ?? '').trim()
  const amountSol = Number(body.amountSol)
  const maxSlippageBps = Number.isFinite(Number(body.slippageBps ?? body.maxSlippageBps))
    ? Number(body.slippageBps ?? body.maxSlippageBps)
    : 100
  const strategyRaw = String(body.strategy ?? 'balanced') as ExecutionStrategyMode
  const sourceRaw = String(body.source ?? 'api') as OpportunitySource
  const symbol = typeof body.symbol === 'string' ? body.symbol : undefined
  const clientRequestId = typeof body.clientRequestId === 'string' ? body.clientRequestId : undefined
  const opportunityId =
    typeof body.opportunityId === 'string' && body.opportunityId.length > 8
      ? body.opportunityId
      : crypto.randomUUID()

  if (!isValidSolanaMint(mint) || !isValidSolanaMint(walletAddress)) {
    return NextResponse.json({ error: 'Valid mint and walletAddress required' }, { status: 400 })
  }
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    return NextResponse.json({ error: 'amountSol must be > 0' }, { status: 400 })
  }
  if (!STRATEGIES.has(strategyRaw)) {
    return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 })
  }
  if (!SOURCES.has(sourceRaw)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
  }

  const opp: OpportunityIntake = {
    opportunityId,
    source: sourceRaw,
    userId: user.id,
    walletAddress,
    mint,
    symbol,
    chain: 'solana',
    side: 'buy',
    amountSol,
    strategy: strategyRaw,
    maxSlippageBps,
    clientRequestId,
    createdAt: new Date().toISOString(),
  }

  execMetricInc(EXEC_METRICS.preparations, { strategy: strategyRaw, source: sourceRaw })

  await insertOpportunity(opp)

  let prepared
  try {
    prepared = await prepareExecution(opp)
  } catch (e) {
    execMetricInc(EXEC_METRICS.preparations, { result: 'error' })
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Prepare failed', code: 'PREPARE_FAILED' },
      { status: 502 },
    )
  }

  const status = preparedToAuditStatus(prepared)
  const auditId = (await insertAuditFromPrepare(opp, prepared, status)) ?? prepared.auditId
  prepared = { ...prepared, auditId }

  execMetricObserve(EXEC_METRICS.latencyPrepareMs, Date.now() - t0, { strategy: strategyRaw })
  if (prepared.allowed) {
    execMetricInc(EXEC_METRICS.allowed, { strategy: strategyRaw })
  } else if (status === 'rejected_capital') {
    execMetricInc(EXEC_METRICS.blockedCapital)
  } else if (status === 'rejected_simulation') {
    execMetricInc(EXEC_METRICS.blockedSim)
    execMetricInc(EXEC_METRICS.simFail)
  } else if (status === 'rejected_safety') {
    execMetricInc(EXEC_METRICS.blockedSafety)
  } else {
    execMetricInc(EXEC_METRICS.blockedRisk)
  }

  let platformFee: ReturnType<typeof computePlatformFeeDisclosure> | undefined
  if (prepared.allowed && prepared.simulation?.expectedOutAmountBase) {
    const feeAccount = isPlatformFeeConfigured()
      ? resolvePlatformFeeAccountForMint(mint)
      : null
    const feeBps = feeAccount ? getPlatformFeeBps() : 0
    platformFee = computePlatformFeeDisclosure({
      feeBps,
      feeAccount,
      feeAmountBase: undefined,
      outAmountBase: prepared.simulation.expectedOutAmountBase,
      inAmountBase: String(Math.floor(amountSol * 1e9)),
      inputMint: SOL_MINT,
      outputMint: mint,
    })
  }

  const httpStatus = prepared.allowed ? 200 : status === 'rejected_risk' ? 403 : 422

  return NextResponse.json(
    {
      ...prepared,
      opportunityId: opp.opportunityId,
      auditId,
      status,
      swapTransaction: prepared.unsignedTxBase64 ?? null,
      platformFee,
      platformFeeBps: platformFee?.feeBps ?? 0,
      compliance: 'Not financial advice · DYOR. Non-custodial — your wallet signs.',
    },
    { status: httpStatus, headers: { 'cache-control': 'no-store' } },
  )
}
