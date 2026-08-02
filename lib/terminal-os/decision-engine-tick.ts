/**
 * Server Decision Engine tick — runs without any browser tab.
 * Writes canonical Decisions to Redis for all Layer 4 consumers.
 */

import 'server-only'

import type { Decision } from '@cryptocheck/decision-contracts'
import { resilientTokens, resilientWhales } from '@/lib/terminal-os/resilient-feed'
import { saveDecision } from '@/lib/terminal-os/decision-store'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { toCanonicalDecision } from '@/features/terminal-os/ai-trade-like-me/lib/to-canonical-decision'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'
import type { EngineId } from '@cryptocheck/decision-contracts'

export type DecisionTickResult = {
  computed: number
  decisions: Decision[]
  at: string
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

  const dna =
    opts?.wallet?.trim()
      ? await getPersistedDna(opts.wallet.trim()).catch(() => null)
      : null

  const decisions: Decision[] = []
  const tokens = (tokensEnv.data ?? []).slice(0, limit)

  for (const token of tokens) {
    const related = (whalesEnv.data ?? []).filter(
      (w) => w.assetSymbol.toUpperCase() === token.symbol.toUpperCase(),
    )
    const unavailable: EngineId[] = []
    if (!dna) unavailable.push('trader-dna')
    if (!related.length) unavailable.push('whale-intelligence')
    unavailable.push('portfolio-intelligence')

    const intel = buildMarketIntel({
      token,
      whales: related.length ? related : whalesEnv.data ?? [],
    })
    const explained = decide(dna && dna.sampleSize >= 3 ? dna : null, intel, {
      unavailableEngines: unavailable,
    })
    const decision = toCanonicalDecision(explained, {
      degradedInputs: unavailable,
      tokenAddress: token.id,
    })
    await saveDecision(decision)
    decisions.push(decision)
  }

  return {
    computed: decisions.length,
    decisions,
    at: new Date().toISOString(),
  }
}
