/**
 * Loss-discipline capital rotation workflow.
 * Reuses Decision Engine + Discovery (decision store) + Security Scanner gate.
 * Advise-only by default — never auto-sell without permission tiers.
 */

import 'server-only'

import type { Decision } from '@cryptocheck/decision-contracts'
import {
  assessDeterioration,
  type DeteriorationVerdict,
} from '@/features/terminal-os/capital-rotation/logic'
import type {
  RotationEvent,
  RotationPermissionMode,
  RotationProposal,
  RotationThreshold,
} from '@/features/terminal-os/capital-rotation/types'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { toCanonicalDecision } from '@/features/terminal-os/ai-trade-like-me/lib/to-canonical-decision'
import type { MarketContext, TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'
import type { TokenRow } from '@/features/terminal-os/shared/types'
import { redis } from '@/lib/cache/redis'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'
import { listRecentDecisions, saveDecision, runDecisionTickIfNeeded } from '@/lib/terminal-os/rotation-helpers'
import {
  DEFAULT_LOSS_THRESHOLD_PCT,
  appendRotationEvent,
  clearRotationProposal,
  computeRotationAggregate,
  findOpenRotationForEntry,
  getRotationProposal,
  getRotationThreshold,
  listRotationEvents,
  patchRotationEntryResult,
  saveRotationProposal,
  saveRotationThreshold,
} from '@/lib/terminal-os/rotation-store'
import { resilientTokens, resilientWhales } from '@/lib/terminal-os/resilient-feed'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { getAvgBuyByMint } from '@/lib/terminal/portfolio-analytics'
import { assessSwapIntent } from '@/lib/trading/risk-gated-swap'
import type { Holding } from '@/types/portfolio-desk'

export { assessDeterioration }
export type { DeteriorationVerdict }

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const HONESTY =
  'A rotation exit may still be a real loss versus entry. The AI aims to cut a weakening position before it becomes a large undisciplined loss and redeploy into current strength — not to eliminate losses.'

async function registerWatchWallet(wallet: string): Promise<void> {
  const key = 'ccai:tos:rotation:watchlist'
  const raw = await redis.get(key)
  let wallets: string[] = []
  if (raw) {
    try {
      wallets = JSON.parse(raw) as string[]
    } catch {
      wallets = []
    }
  }
  wallets = [wallet, ...wallets.filter((w) => w !== wallet)].slice(0, 48)
  await redis.setex(key, 60 * 60 * 24 * 30, JSON.stringify(wallets))
}

export async function resolveLossThreshold(
  wallet: string,
  dna: TraderDna | null,
  userOverridePct?: number | null,
): Promise<RotationThreshold> {
  const existing = await getRotationThreshold(wallet)
  if (typeof userOverridePct === 'number' && Number.isFinite(userOverridePct)) {
    const t: RotationThreshold = {
      wallet,
      thresholdPct: Math.min(40, Math.max(1, userOverridePct)),
      source: 'user',
      personalized: Boolean(dna && dna.sampleSize >= 3),
      updatedAt: new Date().toISOString(),
    }
    await saveRotationThreshold(t)
    return t
  }
  if (existing?.source === 'user') return existing

  if (dna && dna.sampleSize >= 3 && typeof dna.lossTolerancePct === 'number') {
    const t: RotationThreshold = {
      wallet,
      thresholdPct: Math.min(40, Math.max(2, Number(dna.lossTolerancePct.toFixed(1)))),
      source: 'trader_dna',
      personalized: true,
      updatedAt: new Date().toISOString(),
    }
    await saveRotationThreshold(t)
    return t
  }

  const t: RotationThreshold = {
    wallet,
    thresholdPct: DEFAULT_LOSS_THRESHOLD_PCT,
    source: 'default',
    personalized: false,
    updatedAt: new Date().toISOString(),
  }
  await saveRotationThreshold(t)
  return t
}

function pnlFromHolding(
  h: Holding,
): { pnl: number; basis: 'entry' | 'change_24h' } | null {
  if (h.avgBuyPriceUsd != null && h.avgBuyPriceUsd > 0 && h.priceUsd > 0) {
    return {
      pnl: ((h.priceUsd - h.avgBuyPriceUsd) / h.avgBuyPriceUsd) * 100,
      basis: 'entry',
    }
  }
  // Honest fallback: 24h change is not entry PnL — label as such upstream
  if (typeof h.change24hPct === 'number' && Number.isFinite(h.change24hPct)) {
    return { pnl: h.change24hPct, basis: 'change_24h' }
  }
  return null
}

function tokenForHolding(h: Holding, tokens: TokenRow[]): TokenRow {
  const hit = tokens.find((t) => t.id === h.mint || t.symbol.toUpperCase() === h.symbol.toUpperCase())
  if (hit) return hit
  return {
    id: h.mint,
    symbol: h.symbol,
    name: h.name,
    chain: 'solana',
    priceUsd: h.priceUsd,
    change24hPct: h.change24hPct ?? 0,
    volume24hUsd: 0,
    liquidityUsd: 0,
    marketCapUsd: 0,
    txCount24h: 0,
    buySellRatio: 1,
    sparkline: [],
    logoUrl: h.logoUrl ?? undefined,
  }
}

async function pickRotationCandidate(
  exitMint: string,
  wallet: string,
): Promise<{ decision: Decision; token: TokenRow; securityVerdict: string; securityPassed: boolean } | null> {
  await runDecisionTickIfNeeded()
  const decisions = await listRecentDecisions(16)
  const buys = decisions
    .filter((d) => d.action === 'BUY' && (d.marketConfidence ?? d.confidence) >= 70)
    .filter((d) => {
      const addr = d.subject.kind === 'token' ? d.subject.address : undefined
      const sym = d.subject.kind === 'token' ? d.subject.symbol : undefined
      if (addr && addr === exitMint) return false
      return true
    })
    .sort((a, b) => (b.marketConfidence ?? b.confidence) - (a.marketConfidence ?? a.confidence))

  const top = buys[0]
  if (!top || top.subject.kind !== 'token') return null

  const topSubject = top.subject
  const mint = topSubject.address || topSubject.symbol
  const symbol = topSubject.symbol
  const [tokensEnv] = await Promise.all([resilientTokens('solana', 24)])
  const token =
    (tokensEnv.data ?? []).find((t) => t.id === mint || t.symbol === symbol) ??
    ({
      id: mint,
      symbol,
      name: symbol,
      chain: 'solana' as const,
      priceUsd: 0,
      change24hPct: 0,
      volume24hUsd: 0,
      liquidityUsd: 0,
      marketCapUsd: 0,
      txCount24h: 0,
      buySellRatio: 1,
      sparkline: [],
    } satisfies TokenRow)

  // Same Security Scanner gate as Intelligence Swap
  let securityVerdict = 'UNKNOWN'
  let securityPassed = false
  try {
    const assessed = await assessSwapIntent({
      walletAddress: wallet,
      fromToken: SOL_MINT,
      toToken: token.id.length >= 32 ? token.id : SOL_MINT,
      amountUsd: 50,
      slippageBps: 100,
      chain: 'solana',
    })
    securityVerdict = assessed.verdict
    securityPassed = assessed.verdict === 'SAFE' || assessed.verdict === 'CAUTION'
    if (assessed.verdict === 'BLOCKED' || assessed.verdict === 'HIGH_RISK') {
      // Try next BUY candidates
      for (const alt of buys.slice(1, 5)) {
        if (alt.subject.kind !== 'token') continue
        const altSubject = alt.subject
        const altMint = altSubject.address || altSubject.symbol
        const altSymbol = altSubject.symbol
        if (altMint.length < 32) continue
        const a2 = await assessSwapIntent({
          walletAddress: wallet,
          fromToken: SOL_MINT,
          toToken: altMint,
          amountUsd: 50,
          slippageBps: 100,
          chain: 'solana',
        })
        if (a2.verdict === 'SAFE' || a2.verdict === 'CAUTION') {
          const altToken =
            (tokensEnv.data ?? []).find((t) => t.id === altMint) ??
            ({ ...token, id: altMint, symbol: altSymbol } satisfies TokenRow)
          return {
            decision: alt,
            token: altToken,
            securityVerdict: a2.verdict,
            securityPassed: true,
          }
        }
      }
      return null
    }
  } catch {
    securityPassed = false
    securityVerdict = 'UNAVAILABLE'
  }

  if (!securityPassed) return null
  return { decision: top, token, securityVerdict, securityPassed }
}

export type RotationTickResult = {
  wallet: string
  proposal: RotationProposal | null
  skippedReason: string | null
  threshold: RotationThreshold
  events: RotationEvent[]
  aggregate: ReturnType<typeof computeRotationAggregate>
}

/**
 * Evaluate holdings for loss-discipline rotation. Always produce advise-only proposals
 * unless caller explicitly passes a higher permission mode (still never auto-executes here).
 */
export async function runCapitalRotationTick(opts: {
  wallet: string
  permissionMode?: RotationPermissionMode
  userThresholdPct?: number | null
}): Promise<RotationTickResult> {
  const wallet = opts.wallet.trim()
  const permissionMode: RotationPermissionMode = opts.permissionMode ?? 'advise_only'
  await registerWatchWallet(wallet)
  const dna = await getPersistedDna(wallet).catch(() => null)
  const threshold = await resolveLossThreshold(wallet, dna, opts.userThresholdPct)
  const events = await listRotationEvents(wallet, 24)
  const aggregate = computeRotationAggregate(events)

  // Do not overwrite an outstanding proposal unless expired
  const existing = await getRotationProposal(wallet)
  if (existing?.status === 'proposed') {
    return {
      wallet,
      proposal: existing,
      skippedReason: 'proposal_pending_user',
      threshold,
      events,
      aggregate,
    }
  }

  let holdings: Holding[] = []
  try {
    const h = await buildHoldingsResponse(wallet)
    holdings = (h.holdings ?? []).filter((x) => (x.amount ?? 0) > 0 && x.mint !== SOL_MINT)
  } catch {
    return {
      wallet,
      proposal: null,
      skippedReason: 'holdings_unavailable',
      threshold,
      events,
      aggregate,
    }
  }

  if (!holdings.length) {
    return {
      wallet,
      proposal: null,
      skippedReason: 'no_open_positions',
      threshold,
      events,
      aggregate,
    }
  }

  // Enrich with FIFO avg-buy when holdings service leaves avgBuyPriceUsd null (~200–800ms)
  const avgBuyMap = await getAvgBuyByMint(wallet).catch(() => new Map<string, number>())
  holdings = holdings.map((h) => ({
    ...h,
    avgBuyPriceUsd: h.avgBuyPriceUsd ?? avgBuyMap.get(h.mint) ?? null,
  }))

  const [tokensEnv, whalesEnv] = await Promise.all([
    resilientTokens('solana', 24),
    resilientWhales(24),
  ])
  const tokens = tokensEnv.data ?? []
  const whales = whalesEnv.data ?? []

  // Find worst position that breaches threshold with genuine deterioration
  type Candidate = {
    holding: Holding
    pnl: number
    pnlBasis: 'entry' | 'change_24h'
    intel: MarketContext
    det: DeteriorationVerdict
    exitDecision: Decision
  }
  let best: Candidate | null = null

  for (const holding of holdings) {
    const measured = pnlFromHolding(holding)
    if (measured == null || measured.pnl > -threshold.thresholdPct) continue
    const { pnl, basis: pnlBasis } = measured

    const token = tokenForHolding(holding, tokens)
    const related = whales.filter(
      (w) => w.assetSymbol.toUpperCase() === holding.symbol.toUpperCase(),
    )
    const intel = buildMarketIntel({
      token,
      whales: related.length ? related : whales,
    })
    const det = assessDeterioration(intel, pnl, threshold.thresholdPct)
    if (!det.genuine) continue

    const explained = decide(dna && dna.sampleSize >= 3 ? dna : null, intel, {
      hasOpenPosition: true,
      unavailableEngines: dna && dna.sampleSize >= 3 ? [] : ['trader-dna'],
    })
    const pnlLabel = pnlBasis === 'entry' ? 'from entry' : 'vs 24h (entry unavailable)'
    // Force EXIT action for rotation (position is open + genuine deterioration)
    const exitExplained = {
      ...explained,
      action: 'EXIT' as const,
      summary: `EXIT $${holding.symbol} · ${pnl.toFixed(1)}% ${pnlLabel} · ${det.reasons.slice(0, 2).join(', ')}`,
      reasons: [
        `Loss-discipline threshold −${threshold.thresholdPct}% crossed (${threshold.source}).`,
        ...det.reasons,
        ...explained.reasons.slice(0, 2),
      ],
    }
    const exitDecision = toCanonicalDecision(exitExplained, {
      tokenAddress: holding.mint,
      degradedInputs: dna && dna.sampleSize >= 3 ? undefined : ['trader-dna'],
    })
    await saveDecision(exitDecision)

    if (!best || pnl < best.pnl) {
      best = { holding, pnl, pnlBasis, intel, det, exitDecision }
    }
  }

  if (!best) {
    return {
      wallet,
      proposal: null,
      skippedReason: 'no_genuine_deterioration',
      threshold,
      events,
      aggregate,
    }
  }

  const candidate = await pickRotationCandidate(best.holding.mint, wallet)
  if (!candidate) {
    return {
      wallet,
      proposal: null,
      skippedReason: 'no_secure_rotation_candidate',
      threshold,
      events,
      aggregate,
    }
  }

  // Fresh independent BUY Decision for candidate (already from store; re-save for linkage)
  await saveDecision(candidate.decision)

  const proposal: RotationProposal = {
    id: `rot-${wallet.slice(0, 6)}-${Date.now()}`,
    wallet,
    status: 'proposed',
    permissionMode,
    exit: {
      mint: best.holding.mint,
      symbol: best.holding.symbol,
      pnlPctFromEntry: Number(best.pnl.toFixed(2)),
      pnlBasis: best.pnlBasis,
      decision: best.exitDecision,
      deteriorationReasons: best.det.reasons,
    },
    entry: {
      mint: candidate.token.id,
      symbol: candidate.token.symbol,
      decision: candidate.decision,
      securityVerdict: candidate.securityVerdict,
      securityPassed: candidate.securityPassed,
    },
    thresholdPct: threshold.thresholdPct,
    thresholdSource: threshold.source,
    createdAt: new Date().toISOString(),
    honestyNote: HONESTY,
  }

  // Never auto-execute in this tick — even bounded_autonomy only stores a proposal
  // that still requires the confirm API. Full autonomy is not offered as default path.
  await saveRotationProposal(proposal)

  return {
    wallet,
    proposal,
    skippedReason: null,
    threshold,
    events,
    aggregate,
  }
}

export async function confirmRotationProposal(
  wallet: string,
  action: 'approve' | 'reject',
): Promise<{ ok: boolean; event?: RotationEvent; proposal?: RotationProposal; error?: string }> {
  const proposal = await getRotationProposal(wallet)
  if (!proposal || proposal.status !== 'proposed') {
    return { ok: false, error: 'No pending rotation proposal' }
  }

  if (action === 'reject') {
    const rejected = { ...proposal, status: 'rejected' as const }
    await saveRotationProposal(rejected)
    return { ok: true, proposal: rejected }
  }

  // Approve logs the linked event — actual wallet signing stays on Intelligence Swap / Execution Desk
  const event: RotationEvent = {
    id: proposal.id,
    wallet,
    linkedAt: new Date().toISOString(),
    exit: {
      mint: proposal.exit.mint,
      symbol: proposal.exit.symbol,
      pnlPctFromEntry: proposal.exit.pnlPctFromEntry,
      reason: proposal.exit.deteriorationReasons.join(', '),
      decisionId: proposal.exit.decision.id,
    },
    entry: {
      mint: proposal.entry.mint,
      symbol: proposal.entry.symbol,
      confidence: proposal.entry.decision.marketConfidence ?? proposal.entry.decision.confidence,
      reason: proposal.entry.decision.reasoning.slice(0, 200),
      decisionId: proposal.entry.decision.id,
    },
    exitResultPct: proposal.exit.pnlPctFromEntry,
    entryResultPct: null,
    thresholdPct: proposal.thresholdPct,
    permissionMode: proposal.permissionMode,
  }
  await appendRotationEvent(event)
  const approved = { ...proposal, status: 'approved' as const }
  await saveRotationProposal(approved)
  // Clear so next tick can propose again after user executes
  await clearRotationProposal(wallet)

  return { ok: true, event, proposal: approved }
}

/**
 * After Intelligence Swap confirms a BUY into a rotation entry mint,
 * mark-to-market entryResultPct from FIFO cost basis when available.
 * Never fabricates a result when price or entry is missing.
 */
export async function recordRotationEntryFill(opts: {
  wallet: string
  entryMint: string
}): Promise<{ ok: boolean; event?: RotationEvent; error?: string }> {
  const wallet = opts.wallet.trim()
  const entryMint = opts.entryMint.trim()
  const open = await findOpenRotationForEntry(wallet, entryMint)
  if (!open) {
    return { ok: false, error: 'No open rotation awaiting entry result for this mint' }
  }

  let holdings: Holding[] = []
  try {
    const h = await buildHoldingsResponse(wallet)
    holdings = h.holdings ?? []
  } catch {
    return { ok: false, error: 'Holdings unavailable — entry result not patched' }
  }

  const holding = holdings.find((x) => x.mint === entryMint)
  if (!holding || !(holding.priceUsd > 0)) {
    return { ok: false, error: 'Entry mint not in holdings with a live price — not patched' }
  }

  const avgBuyMap = await getAvgBuyByMint(wallet).catch(() => new Map<string, number>())
  const avg =
    holding.avgBuyPriceUsd && holding.avgBuyPriceUsd > 0
      ? holding.avgBuyPriceUsd
      : avgBuyMap.get(entryMint)
  if (!(avg != null && avg > 0)) {
    return { ok: false, error: 'Cost basis unavailable — entry result left null (not fabricated)' }
  }

  const pct = ((holding.priceUsd - avg) / avg) * 100
  const updated = await patchRotationEntryResult(wallet, open.id, pct)
  if (!updated) return { ok: false, error: 'Failed to patch rotation event' }
  return { ok: true, event: updated }
}
