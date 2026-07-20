import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { requireSessionFullAccess } from '@/lib/middleware/require-full-access'
import { assessSwapIntent, type SwapIntent } from '@/lib/trading/risk-gated-swap'
import { buildJupiterSwapTransaction, getJupiterQuote } from '@/lib/trading/jupiter-client'
import {
  SOL_MINT,
  getPlatformFeeBps,
  isPlatformFeeConfigured,
} from '@/lib/trading/platform-fee-config'
import { isValidSolanaMint, logSnipeAction } from '@/lib/signal-aggregator/snipe-execution'
import { computePlatformFeeDisclosure } from '@/lib/launchpad/platform-fee'
import { assertPlatformFeeAccountForOutput } from '@/lib/launchpad/fee-account'
import {
  SNIPER_JITO_TIP_LAMPORTS,
  SNIPER_PRIORITY_FEE_LAMPORTS,
} from '@/lib/launchpad/constants'
import {
  resolveVerdictForSnipe,
  setCachedVerdict,
  type CachedVerdict,
} from '@/lib/launchpad/verdict-cache'
import { logUserBlock } from '@/lib/launchpad/saved-you'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { toRevenueVerdict } from '@/lib/revenue-dashboard/types'

export const dynamic = 'force-dynamic'

/** Hard ceiling on a single snipe input (SOL) — money-safety guardrail. */
const MAX_SNIPE_SOL = Number(process.env.SNIPER_MAX_AMOUNT_SOL ?? 5)

function prioritizationOption():
  | number
  | 'auto'
  | { jitoTipLamports: number }
  | undefined {
  if (SNIPER_JITO_TIP_LAMPORTS > 0) {
    return { jitoTipLamports: SNIPER_JITO_TIP_LAMPORTS }
  }
  if (SNIPER_PRIORITY_FEE_LAMPORTS > 0) return SNIPER_PRIORITY_FEE_LAMPORTS
  return undefined
}

/**
 * POST /api/signals/snipe/build-swap
 * Non-custodial: UNSIGNED base64 tx. Cache-first verdict → hard-block DANGER.
 * Transparent Jupiter platform fee in response for confirm sheet.
 */
export async function POST(req: Request) {
  const tReq = Date.now()
  const gate = await requireSessionFullAccess()
  if (!gate.ok) return (gate as { response: NextResponse }).response

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const mint = String(body.mint ?? '').trim()
  const userPublicKey = String(body.userPublicKey ?? '').trim()
  const amountSol = Number(body.amountSol)
  const slippageBps = Number.isFinite(Number(body.slippageBps)) ? Number(body.slippageBps) : 100
  const amountUsd = Number.isFinite(Number(body.amountUsd)) ? Math.max(0, Number(body.amountUsd)) : 0
  const userConfirmed = body.confirm === true
  const signalId = typeof body.signalId === 'string' ? body.signalId : mint
  const symbol = typeof body.symbol === 'string' ? body.symbol : mint.slice(0, 6)

  if (!isValidSolanaMint(mint)) {
    return NextResponse.json({ error: 'valid mint required' }, { status: 400 })
  }
  if (!isValidSolanaMint(userPublicKey)) {
    return NextResponse.json({ error: 'valid userPublicKey required' }, { status: 400 })
  }
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    return NextResponse.json({ error: 'amountSol must be > 0' }, { status: 400 })
  }
  if (amountSol > MAX_SNIPE_SOL) {
    return NextResponse.json(
      { error: `amountSol exceeds ceiling (${MAX_SNIPE_SOL} SOL)` },
      { status: 400 },
    )
  }

  // Cache-first verdict — zero scan-wait on hit; DANGER still hard-blocks.
  const tResolve0 = Date.now()
  const { path: verdictPath, entry: cached } = await resolveVerdictForSnipe(mint, async () => {
    const assessment = await assessRiskByMint(mint, 'solana', 'fast')
    const ui = toRevenueVerdict(assessment.verdict)
    const entry: CachedVerdict = {
      mint,
      verdict: assessment.verdict === 'BLOCKED' ? 'BLOCKED' : ui === 'DANGER' ? 'DANGER' : assessment.verdict,
      score: assessment.safetyScore,
      riskScore: assessment.riskScore,
      factors: assessment.snapshot.reasoning.evidence.slice(0, 5).map((e) => e.label),
      scannedAt: new Date().toISOString(),
    }
    return entry
  })
  const resolve_delta_ms = Date.now() - tResolve0
  console.info(
    `[snipe] request_received_ms=${tReq} verdict path=${verdictPath} mint=${mint.slice(0, 8)}… verdict=${cached.verdict} resolve_delta_ms=${resolve_delta_ms}`,
  )

  if (cached.verdict === 'BLOCKED' || cached.verdict === 'DANGER' || cached.riskScore >= 80) {
    await logSnipeAction({
      id: crypto.randomUUID(),
      userId: gate.userId,
      signalId,
      mint,
      symbol,
      action: 'blocked',
      allowed: false,
      neuralScore: cached.score,
      verdict: cached.verdict,
      redFlags: [],
      evidenceSummary: `Cached/inline DANGER hard-block (${verdictPath})`,
      blockedReason: `Token risk score ${cached.riskScore}/100 — hard block`,
      createdAt: new Date().toISOString(),
    })
    await logUserBlock({
      userId: gate.userId,
      mint,
      symbol,
      verdict: cached.verdict,
      score: cached.score,
      evidence: cached.factors.join('; '),
      source: 'snipe',
      intendedAmountUsd: amountUsd || amountSol * 150,
    })
    const tRes = Date.now()
    const timing = {
      request_received_ms: tReq,
      response_returned_ms: tRes,
      total_delta_ms: tRes - tReq,
      resolve_delta_ms,
      assess_delta_ms: 0,
    }
    console.info(`[snipe] response_returned_ms=${tRes} total_delta_ms=${timing.total_delta_ms} verdictPath=${verdictPath}`)
    return NextResponse.json(
      {
        blocked: true,
        verdictPath,
        decision: {
          allowed: false,
          riskScore: cached.riskScore,
          verdict: 'BLOCKED',
          blockedReason: `Token risk score ${cached.riskScore}/100 exceeds the hard block threshold.`,
          reasons: cached.factors,
        },
        timing,
        compliance: SIGNAL_COMPLIANCE,
      },
      { status: 403 },
    )
  }

  const intent: SwapIntent = {
    walletAddress: userPublicKey,
    fromToken: SOL_MINT,
    toToken: mint,
    amountUsd,
    slippageBps,
    chain: 'solana',
  }

  // Always fresh-gate after cache: stale SAFE cannot bypass risk≥80 (assessSwapIntent → assessRiskByMint).
  const tAssess0 = Date.now()
  const decision = await assessSwapIntent(intent)
  const assess_delta_ms = Date.now() - tAssess0
  if (verdictPath === 'cache-hit' && (!decision.allowed || decision.riskScore >= 80)) {
    console.warn(
      `[snipe] stale-cache overridden mint=${mint.slice(0, 8)}… cache=${cached.verdict} fresh=${decision.verdict} assess_delta_ms=${assess_delta_ms}`,
    )
    await setCachedVerdict({
      mint,
      verdict: decision.verdict === 'BLOCKED' ? 'BLOCKED' : 'DANGER',
      score: 100 - decision.riskScore,
      riskScore: decision.riskScore,
      factors: decision.reasons.slice(0, 5),
      scannedAt: new Date().toISOString(),
    })
  }

  if (!decision.allowed) {
    await logSnipeAction({
      id: crypto.randomUUID(),
      userId: gate.userId,
      signalId,
      mint,
      symbol,
      action: 'blocked',
      allowed: false,
      neuralScore: 100 - decision.riskScore,
      verdict: decision.verdict,
      redFlags: [],
      evidenceSummary: decision.reasons.join('; ') || 'Blocked by risk policy',
      blockedReason: decision.blockedReason ?? 'risk policy',
      createdAt: new Date().toISOString(),
    })
    await logUserBlock({
      userId: gate.userId,
      mint,
      symbol,
      verdict: decision.verdict,
      score: 100 - decision.riskScore,
      evidence: decision.blockedReason ?? decision.reasons.join('; '),
      source: 'snipe',
      intendedAmountUsd: amountUsd || amountSol * 150,
    })
    const tRes = Date.now()
    const timing = {
      request_received_ms: tReq,
      response_returned_ms: tRes,
      total_delta_ms: tRes - tReq,
      resolve_delta_ms,
      assess_delta_ms,
    }
    console.info(`[snipe] response_returned_ms=${tRes} total_delta_ms=${timing.total_delta_ms} verdictPath=${verdictPath} assess_delta_ms=${assess_delta_ms}`)
    return NextResponse.json(
      { blocked: true, verdictPath, decision, timing, compliance: SIGNAL_COMPLIANCE },
      { status: 403 },
    )
  }

  if (decision.verdict === 'HIGH_RISK' && !userConfirmed) {
    return NextResponse.json(
      { requiresConfirm: true, verdictPath, decision, compliance: SIGNAL_COMPLIANCE },
      { status: 409 },
    )
  }

  await setCachedVerdict({
    mint,
    verdict: decision.verdict,
    score: 100 - decision.riskScore,
    riskScore: decision.riskScore,
    factors: decision.reasons.slice(0, 5),
    scannedAt: new Date().toISOString(),
  })

  const lamports = Math.floor(amountSol * 1_000_000_000)
  const feeConfigured = isPlatformFeeConfigured()
  let feeBps = 0
  let feeAccount: string | null = null
  const prio = prioritizationOption()

  if (feeConfigured) {
    const feeCheck = await assertPlatformFeeAccountForOutput(mint)
    if (feeCheck.ok === false) {
      // Never disclose a fee we cannot collect — hard error before wallet sign.
      return NextResponse.json(
        {
          error: feeCheck.message,
          code: feeCheck.code,
          compliance: SIGNAL_COMPLIANCE,
        },
        { status: 422 },
      )
    }
    feeBps = getPlatformFeeBps()
    feeAccount = feeCheck.feeAccount
  }

  let swapTransaction: string
  let platformFee
  let priceImpactPct = 0
  try {
    const quote = await getJupiterQuote(
      SOL_MINT,
      mint,
      lamports,
      slippageBps,
      feeAccount ? { platformFeeBps: feeBps } : undefined,
    )
    priceImpactPct = Number(quote.priceImpactPct) * 100
    platformFee = computePlatformFeeDisclosure({
      feeBps,
      feeAccount,
      outAmountBase: quote.outAmount,
      inAmountBase: quote.inAmount,
      inputMint: SOL_MINT,
      outputMint: mint,
      feeAmountBase: (quote.raw as { platformFee?: { amount?: string } })?.platformFee?.amount
        ? String((quote.raw as { platformFee: { amount: string } }).platformFee.amount)
        : undefined,
    })
    swapTransaction = await buildJupiterSwapTransaction(quote, userPublicKey, {
      ...(feeAccount ? { feeAccount } : {}),
      ...(prio != null ? { prioritizationFeeLamports: prio } : {}),
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'failed to build swap', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }

  await logSnipeAction({
    id: crypto.randomUUID(),
    userId: gate.userId,
    signalId,
    mint,
    symbol,
    action: 'attempt',
    allowed: true,
    neuralScore: 100 - decision.riskScore,
    verdict: decision.verdict,
    redFlags: [],
    evidenceSummary: `Built swap for ${amountSol} SOL · verdictPath=${verdictPath} · fee=${platformFee.feeAmountHuman}`,
    createdAt: new Date().toISOString(),
  })

  const tRes = Date.now()
  return NextResponse.json(
    {
      swapTransaction,
      decision,
      verdictPath,
      platformFeeBps: feeBps,
      platformFee,
      priceImpactPct,
      slippageBps,
      amountSol,
      timing: {
        request_received_ms: tReq,
        response_returned_ms: tRes,
        total_delta_ms: tRes - tReq,
        resolve_delta_ms,
      },
      compliance: SIGNAL_COMPLIANCE,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
