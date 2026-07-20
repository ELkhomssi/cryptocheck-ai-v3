import 'server-only'

import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { redis } from '@/lib/cache/redis'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import { buildJupiterSwapTransaction, getJupiterQuote } from '@/lib/trading/jupiter-client'
import {
  getPlatformFeeAccount,
  getPlatformFeeBps,
  SOL_MINT,
} from '@/lib/trading/platform-fee-config'
import { fetchSolUsdPrice } from '@/lib/pricing/sol-usd'
import { computePlatformFeeDisclosure } from '@/lib/launchpad/platform-fee'
import { logUserBlock } from '@/lib/launchpad/saved-you'
import { buildSwapQuoteFromJupiter } from '@/lib/revenue-dashboard/swap-quote'
import type {
  GuardianAutoExitConfig,
  GuardianAutoExitEvent,
  WatchDegradeEvent,
} from './constants'
import {
  GUARDIAN_KILL_REDIS_PREFIX,
  GUARDIAN_PENDING_REDIS_PREFIX,
} from './constants'

const DEFAULT_MAX_SLIPPAGE_BPS = 150
const DEFAULT_MIN_PROCEEDS_RATIO = 0.85
const PENDING_TTL_SEC = 15 * 60

function killKey(userId: string): string {
  return `${GUARDIAN_KILL_REDIS_PREFIX}${userId}`
}

function pendingKey(id: string): string {
  return `${GUARDIAN_PENDING_REDIS_PREFIX}${id}`
}

export async function isGuardianKillSwitchActive(userId: string): Promise<boolean> {
  try {
    const v = await redis.get(killKey(userId))
    return v === '1' || v === 'true'
  } catch {
    return false
  }
}

export async function setGuardianKillSwitch(userId: string, active: boolean): Promise<void> {
  if (active) {
    await redis.set(killKey(userId), '1')
  } else {
    await redis.del(killKey(userId))
  }
}

export async function getGuardianAutoExitConfig(
  userId: string,
  mint: string,
): Promise<GuardianAutoExitConfig> {
  const sb = getSupabaseAdmin()
  const [{ data: globalRow }, { data: posRow }] = await Promise.all([
    sb
      .from('guardian_auto_exit_settings')
      .select(
        'enabled, max_slippage_bps, min_proceeds_ratio, authorized_wallet, authorized_at',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    sb
      .from('guardian_auto_exit_positions')
      .select(
        'enabled, max_slippage_bps, min_proceeds_ratio, authorized_wallet, authorized_at',
      )
      .eq('user_id', userId)
      .eq('mint', mint)
      .maybeSingle(),
  ])

  const globalEnabled = Boolean(globalRow?.enabled)
  const posEnabled = Boolean(posRow?.enabled)
  const enabled = posRow ? posEnabled : globalEnabled

  const maxSlippageBps =
    posRow?.max_slippage_bps ??
    globalRow?.max_slippage_bps ??
    DEFAULT_MAX_SLIPPAGE_BPS
  const minProceedsRatio = Number(
    posRow?.min_proceeds_ratio ??
      globalRow?.min_proceeds_ratio ??
      DEFAULT_MIN_PROCEEDS_RATIO,
  )
  const authorizedWallet =
    (posRow?.authorized_wallet as string | null) ??
    (globalRow?.authorized_wallet as string | null) ??
    null
  const authorizedAt =
    (posRow?.authorized_at as string | null) ??
    (globalRow?.authorized_at as string | null) ??
    null

  return {
    enabled,
    maxSlippageBps: Number(maxSlippageBps),
    minProceedsRatio,
    authorizedWallet,
    authorizedAt,
    globalDefault: !posRow && globalEnabled,
  }
}

async function resolvePositionForUser(
  userId: string,
  mint: string,
): Promise<{ balance: number; valueUsd: number; decimals: number } | null> {
  const sb = getSupabaseAdmin()
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: snap } = await sb
    .from('portfolio_snapshots')
    .select('snapshot_data')
    .eq('user_id', userId)
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const holdings = Array.isArray(snap?.snapshot_data) ? snap!.snapshot_data : []
  for (const h of holdings) {
    if (!h || typeof h !== 'object') continue
    const row = h as { mint?: string; balance?: number; valueUsd?: number; decimals?: number }
    if (row.mint?.trim() === mint) {
      const balance = Number(row.balance ?? 0)
      const valueUsd = Number(row.valueUsd ?? 0)
      if (balance <= 0) return null
      return {
        balance,
        valueUsd,
        decimals: Number(row.decimals ?? 6),
      }
    }
  }
  return null
}

function parseInputAmountBase(mint: string, amount: number, decimals: number): number {
  if (mint === SOL_MINT) return Math.max(1, Math.floor(amount * 1e9))
  return Math.max(1, Math.floor(amount * 10 ** decimals))
}

async function insertGuardianEvent(row: {
  id: string
  userId: string
  mint: string
  degradeEventId: string | null
  status: GuardianAutoExitEvent['status']
  reason: string | null
  walletAddress: string | null
  inputAmount: number | null
  expectedOutputUsd: number | null
  priceImpactPct: number | null
  slippageBps: number | null
  swapTxBase64?: string | null
  txSignature?: string | null
  platformFeeBps?: number | null
}): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb.from('guardian_auto_exit_events').insert({
    id: row.id,
    user_id: row.userId,
    mint: row.mint,
    degrade_event_id: row.degradeEventId,
    status: row.status,
    reason: row.reason,
    wallet_address: row.walletAddress,
    input_amount: row.inputAmount,
    expected_output_usd: row.expectedOutputUsd,
    price_impact_pct: row.priceImpactPct,
    slippage_bps: row.slippageBps,
    swap_tx_base64: row.swapTxBase64 ?? null,
    tx_signature: row.txSignature ?? null,
    platform_fee_bps: row.platformFeeBps ?? null,
    completed_at: row.status === 'completed' ? new Date().toISOString() : null,
  })
}

export type PendingGuardianExit = {
  id: string
  mint: string
  swapTxBase64: string
  swapQuote: ReturnType<typeof buildSwapQuoteFromJupiter>
  walletAddress: string
  platformFeeDisclosure: ReturnType<typeof computePlatformFeeDisclosure>
  createdAt: string
}

/**
 * On DANGER degrade for a held position with auto-exit armed:
 * build unsigned Jupiter sell tx + store pending for wallet signature.
 * Aborts (never force-sells) when quote fails slippage/liquidity guards.
 */
export async function maybePrepareGuardianAutoExit(
  event: WatchDegradeEvent,
): Promise<{ prepared: boolean; eventId?: string; aborted?: string }> {
  if (event.newVerdict !== 'DANGER' || !event.held) {
    return { prepared: false }
  }

  const tier = await resolveSignalTier({ userId: event.userId })
  if (tier !== 'premium') return { prepared: false }

  if (await isGuardianKillSwitchActive(event.userId)) {
    const id = randomUUID()
    await insertGuardianEvent({
      id,
      userId: event.userId,
      mint: event.mint,
      degradeEventId: event.id,
      status: 'killed',
      reason: 'Global Guardian kill-switch active',
      walletAddress: null,
      inputAmount: null,
      expectedOutputUsd: null,
      priceImpactPct: null,
      slippageBps: null,
    })
    return { prepared: false, aborted: 'kill-switch' }
  }

  const config = await getGuardianAutoExitConfig(event.userId, event.mint)
  if (!config.enabled || !config.authorizedWallet) {
    return { prepared: false }
  }

  const position = await resolvePositionForUser(event.userId, event.mint)
  if (!position) {
    return { prepared: false, aborted: 'no-position' }
  }

  const wallet = config.authorizedWallet
  const slippageBps = config.maxSlippageBps
  const amountBase = parseInputAmountBase(event.mint, position.balance, position.decimals)

  let quote
  let solUsd = 0
  try {
    ;[quote, solUsd] = await Promise.all([
      getJupiterQuote(event.mint, SOL_MINT, amountBase, slippageBps, {
        platformFeeBps: getPlatformFeeBps(),
      }),
      fetchSolUsdPrice(),
    ])
  } catch (e) {
    const id = randomUUID()
    const reason = e instanceof Error ? e.message : 'Quote unavailable'
    await insertGuardianEvent({
      id,
      userId: event.userId,
      mint: event.mint,
      degradeEventId: event.id,
      status: 'aborted',
      reason: `Liquidity guard: ${reason}`,
      walletAddress: wallet,
      inputAmount: position.balance,
      expectedOutputUsd: null,
      priceImpactPct: null,
      slippageBps,
    })
    return { prepared: false, aborted: reason }
  }

  const swapQuote = buildSwapQuoteFromJupiter(quote, { solUsd })
  const outSol = Number(quote.outAmount) / 1e9
  const expectedOutputUsd = outSol * solUsd
  const priceImpactPct = swapQuote.priceImpactPct

  const minProceedsUsd = position.valueUsd * config.minProceedsRatio
  const slippagePctLimit = slippageBps / 100

  if (priceImpactPct > slippagePctLimit || expectedOutputUsd < minProceedsUsd) {
    const id = randomUUID()
    const reason = `Quote unacceptable: impact ${priceImpactPct.toFixed(2)}% (max ${slippagePctLimit}%), proceeds ~$${expectedOutputUsd.toFixed(2)} vs min $${minProceedsUsd.toFixed(2)} (${(config.minProceedsRatio * 100).toFixed(0)}% of position)`
    await insertGuardianEvent({
      id,
      userId: event.userId,
      mint: event.mint,
      degradeEventId: event.id,
      status: 'aborted',
      reason,
      walletAddress: wallet,
      inputAmount: position.balance,
      expectedOutputUsd,
      priceImpactPct,
      slippageBps,
    })
    return { prepared: false, aborted: reason }
  }

  const feeAccount = getPlatformFeeAccount()
  let swapTxBase64: string
  try {
    swapTxBase64 = await buildJupiterSwapTransaction(quote, wallet, {
      feeAccount: feeAccount ?? undefined,
    })
  } catch (e) {
    const id = randomUUID()
    const reason = e instanceof Error ? e.message : 'Swap build failed'
    await insertGuardianEvent({
      id,
      userId: event.userId,
      mint: event.mint,
      degradeEventId: event.id,
      status: 'failed',
      reason,
      walletAddress: wallet,
      inputAmount: position.balance,
      expectedOutputUsd,
      priceImpactPct,
      slippageBps,
    })
    return { prepared: false, aborted: reason }
  }

  const eventId = randomUUID()
  const feeBps = getPlatformFeeBps()
  const disclosure = computePlatformFeeDisclosure({
    feeBps,
    feeAccount: getPlatformFeeAccount(),
    outAmountBase: quote.outAmount,
    inAmountBase: quote.inAmount,
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    solUsd,
  })

  await insertGuardianEvent({
    id: eventId,
    userId: event.userId,
    mint: event.mint,
    degradeEventId: event.id,
    status: 'awaiting_signature',
    reason: `DANGER auto-exit prepared: ${event.reason}`,
    walletAddress: wallet,
    inputAmount: position.balance,
    expectedOutputUsd,
    priceImpactPct,
    slippageBps,
    swapTxBase64,
    platformFeeBps: feeBps,
  })

  const pending: PendingGuardianExit = {
    id: eventId,
    mint: event.mint,
    swapTxBase64,
    swapQuote,
    walletAddress: wallet,
    platformFeeDisclosure: disclosure,
    createdAt: new Date().toISOString(),
  }
  await redis.setex(pendingKey(eventId), PENDING_TTL_SEC, JSON.stringify(pending))

  return { prepared: true, eventId }
}

export async function getPendingGuardianExit(
  userId: string,
  pendingId: string,
): Promise<PendingGuardianExit | null> {
  if (await isGuardianKillSwitchActive(userId)) return null

  const raw = await redis.get(pendingKey(pendingId))
  if (raw) {
    try {
      return JSON.parse(raw) as PendingGuardianExit
    } catch {
      /* fall through */
    }
  }

  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from('guardian_auto_exit_events')
    .select('id, user_id, mint, swap_tx_base64, wallet_address, created_at, status')
    .eq('id', pendingId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data || data.status !== 'awaiting_signature' || !data.swap_tx_base64) return null

  return {
    id: data.id,
    mint: data.mint,
    swapTxBase64: data.swap_tx_base64,
    swapQuote: {} as PendingGuardianExit['swapQuote'],
    walletAddress: data.wallet_address ?? '',
    platformFeeDisclosure: computePlatformFeeDisclosure({
      feeBps: getPlatformFeeBps(),
      feeAccount: getPlatformFeeAccount(),
      outAmountBase: '0',
      inAmountBase: '0',
      inputMint: data.mint,
      outputMint: SOL_MINT,
    }),
    createdAt: data.created_at,
  }
}

export async function confirmGuardianAutoExit(input: {
  userId: string
  pendingId: string
  txSignature: string
}): Promise<{ ok: boolean; error?: string }> {
  if (await isGuardianKillSwitchActive(input.userId)) {
    return { ok: false, error: 'Guardian kill-switch is active' }
  }

  const sb = getSupabaseAdmin()
  const { data: row } = await sb
    .from('guardian_auto_exit_events')
    .select('id, user_id, mint, degrade_event_id, expected_output_usd, status')
    .eq('id', input.pendingId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (!row || row.status !== 'awaiting_signature') {
    return { ok: false, error: 'Pending exit not found or already completed' }
  }

  const now = new Date().toISOString()
  await sb
    .from('guardian_auto_exit_events')
    .update({
      status: 'completed',
      tx_signature: input.txSignature,
      completed_at: now,
    })
    .eq('id', input.pendingId)

  await redis.del(pendingKey(input.pendingId))

  const intendedUsd =
    row.expected_output_usd != null ? Number(row.expected_output_usd) : undefined

  await logUserBlock({
    userId: input.userId,
    mint: row.mint,
    verdict: 'DANGER',
    evidence: `Guardian auto-exit completed · tx ${input.txSignature.slice(0, 12)}…`,
    source: 'auto_exit',
    intendedAmountUsd: intendedUsd,
  })

  return { ok: true }
}

export async function listGuardianEventsForUser(
  userId: string,
  limit = 10,
): Promise<GuardianAutoExitEvent[]> {
  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from('guardian_auto_exit_events')
    .select(
      'id, user_id, mint, degrade_event_id, status, reason, wallet_address, input_amount, expected_output_usd, price_impact_pct, slippage_bps, tx_signature, platform_fee_bps, created_at, completed_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    mint: r.mint,
    degradeEventId: r.degrade_event_id,
    status: r.status as GuardianAutoExitEvent['status'],
    reason: r.reason,
    walletAddress: r.wallet_address,
    inputAmount: r.input_amount != null ? Number(r.input_amount) : null,
    expectedOutputUsd: r.expected_output_usd != null ? Number(r.expected_output_usd) : null,
    priceImpactPct: r.price_impact_pct != null ? Number(r.price_impact_pct) : null,
    slippageBps: r.slippage_bps,
    txSignature: r.tx_signature,
    platformFeeBps: r.platform_fee_bps,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }))
}
