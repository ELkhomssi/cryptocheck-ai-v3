import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { requireSessionFullAccess } from '@/lib/middleware/require-full-access'
import { assessSwapIntent, type SwapIntent } from '@/lib/trading/risk-gated-swap'
import { buildJupiterSwapTransaction, getJupiterQuote } from '@/lib/trading/jupiter-client'
import {
  SOL_MINT,
  getPlatformFeeAccount,
  getPlatformFeeBps,
  isPlatformFeeConfigured,
} from '@/lib/trading/platform-fee-config'
import { isValidSolanaMint, logSnipeAction } from '@/lib/signal-aggregator/snipe-execution'

export const dynamic = 'force-dynamic'

/** Hard ceiling on a single snipe input (SOL) — money-safety guardrail. */
const MAX_SNIPE_SOL = Number(process.env.SNIPER_MAX_AMOUNT_SOL ?? 5)

/**
 * POST /api/signals/snipe/build-swap
 * Non-custodial: builds an UNSIGNED base64 swap transaction for the client
 * wallet to sign & send. The server never signs. Every attempt runs through
 * the frozen risk gate (assessSwapIntent) and is logged to signal_snipe_actions.
 *
 * Body: { mint, amountSol, userPublicKey, slippageBps?, amountUsd?, confirm?, signalId?, symbol? }
 */
export async function POST(req: Request) {
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

  const intent: SwapIntent = {
    walletAddress: userPublicKey,
    fromToken: SOL_MINT,
    toToken: mint,
    amountUsd,
    slippageBps,
    chain: 'solana',
  }

  // Frozen risk gate — authoritative kill-switch before we ever build a tx.
  const decision = await assessSwapIntent(intent)

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
    return NextResponse.json(
      { blocked: true, decision, compliance: SIGNAL_COMPLIANCE },
      { status: 403 },
    )
  }

  // DANGER friction — HIGH_RISK requires an explicit typed confirmation.
  if (decision.verdict === 'HIGH_RISK' && !userConfirmed) {
    return NextResponse.json(
      { requiresConfirm: true, decision, compliance: SIGNAL_COMPLIANCE },
      { status: 409 },
    )
  }

  const lamports = Math.floor(amountSol * 1_000_000_000)
  const feeConfigured = isPlatformFeeConfigured()

  let swapTransaction: string
  try {
    const quote = await getJupiterQuote(
      SOL_MINT,
      mint,
      lamports,
      slippageBps,
      feeConfigured ? { platformFeeBps: getPlatformFeeBps() } : undefined,
    )
    swapTransaction = await buildJupiterSwapTransaction(
      quote,
      userPublicKey,
      feeConfigured ? { feeAccount: getPlatformFeeAccount()! } : undefined,
    )
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
    evidenceSummary: decision.reasons.join('; ') || `Built swap for ${amountSol} SOL`,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json(
    {
      // Base64 VersionedTransaction — sign & send in the browser wallet. Never signed server-side.
      swapTransaction,
      decision,
      platformFeeBps: feeConfigured ? getPlatformFeeBps() : 0,
      amountSol,
      slippageBps,
      compliance: SIGNAL_COMPLIANCE,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
