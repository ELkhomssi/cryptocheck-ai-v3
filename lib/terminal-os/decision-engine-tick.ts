/**
 * Server Decision Engine tick — runs without any browser tab.
 * Writes canonical Decisions to Redis for all Layer 4 consumers.
 *
 * Kernel wiring: Market + Whales + Prediction + optional DNA +
 * Portfolio (open position) + Security Scanner (scan gateway).
 */

import 'server-only'

import type { Decision, EngineId } from '@cryptocheck/decision-contracts'
import { resilientTokens, resilientWhales } from '@/lib/terminal-os/resilient-feed'
import { saveDecision, saveDecisionTickMeta } from '@/lib/terminal-os/decision-store'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { toCanonicalDecision } from '@/features/terminal-os/ai-trade-like-me/lib/to-canonical-decision'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { redis } from '@/lib/cache/redis'

export type DecisionTickResult = {
  computed: number
  decisions: Decision[]
  at: string
}

async function loadOpenMints(wallet: string | null | undefined): Promise<Set<string>> {
  const open = new Set<string>()
  if (!wallet?.trim()) return open
  try {
    const holdings = await buildHoldingsResponse(wallet.trim())
    for (const h of holdings.holdings ?? []) {
      if ((h.valueUsd ?? 0) > 1 || (h.amount ?? 0) > 0) {
        open.add(h.mint)
      }
    }
  } catch {
    // portfolio unavailable — leave empty; tick marks portfolio degraded
  }
  return open
}

/** Watched wallets for personalized ticks (capital rotation + DNA). */
async function loadWatchWallets(): Promise<string[]> {
  try {
    const raw = await redis.get('ccai:tos:rotation:watchlist')
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : []
  } catch {
    return []
  }
}

export async function runDecisionTick(opts?: {
  wallet?: string | null
  limit?: number
}): Promise<DecisionTickResult> {
  const limit = Math.min(24, Math.max(4, opts?.limit ?? 12))
  const [tokensEnv, whalesEnv] = await Promise.all([
    resilientTokens('solana', Math.max(limit, 16)),
    resilientWhales(24),
  ])

  const primaryWallet = opts?.wallet?.trim() || (await loadWatchWallets())[0] || null
  const dna =
    primaryWallet
      ? await getPersistedDna(primaryWallet).catch(() => null)
      : null
  const openMints = await loadOpenMints(primaryWallet)

  const decisions: Decision[] = []
  const tokens = (tokensEnv.data ?? []).slice(0, limit)

  for (const token of tokens) {
    const related = (whalesEnv.data ?? []).filter(
      (w) => w.assetSymbol.toUpperCase() === token.symbol.toUpperCase(),
    )
    const unavailable: EngineId[] = []
    if (!dna) unavailable.push('trader-dna')
    if (!related.length) unavailable.push('whale-intelligence')
    if (!primaryWallet) unavailable.push('portfolio-intelligence')

    // ~80–200ms estimated — Security Scanner via scan gateway (not heuristics)
    let tokenScore: number | undefined
    let riskScore: number | undefined
    let securityBand: 'excellent' | 'good' | 'caution' | 'danger' | undefined
    try {
      if (token.chain === 'solana' || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token.id)) {
        const assess = await assessRiskByMint(token.id, 'solana', 'fast')
        tokenScore = assess.safetyScore
        riskScore = assess.riskScore
        securityBand =
          assess.safetyScore >= 80
            ? 'excellent'
            : assess.safetyScore >= 65
              ? 'good'
              : assess.safetyScore >= 45
                ? 'caution'
                : 'danger'
      } else {
        unavailable.push('security-scanner')
      }
    } catch {
      unavailable.push('security-scanner')
    }

    const hasOpenPosition = openMints.has(token.id)

    const intel = buildMarketIntel({
      token,
      whales: related.length ? related : whalesEnv.data ?? [],
      tokenScore,
      riskScore,
      securityBand,
    })
    const hasDna = Boolean(
      dna &&
        dna.sampleSize >= 3 &&
        ((dna.avgHoldingMs ?? 0) > 0 || (dna.entryConditionProfile?.length ?? 0) > 0),
    )
    const explained = decide(hasDna ? dna : null, intel, {
      hasOpenPosition,
    })
    const decision = toCanonicalDecision(explained, {
      degradedInputs: unavailable,
      tokenAddress: token.id,
      personalized: hasDna,
    })
    await saveDecision(decision)
    decisions.push(decision)
  }

  const at = new Date().toISOString()
  await saveDecisionTickMeta({
    at,
    scanned: tokens.length,
    published: decisions.length,
    buyCount: decisions.filter((d) => d.action === 'BUY').length,
    waitCount: decisions.filter((d) => d.action === 'WAIT' || d.action === 'DO_NOTHING').length,
    wallet: primaryWallet,
    openPositions: openMints.size,
  })

  return { computed: decisions.length, decisions, at }
}
