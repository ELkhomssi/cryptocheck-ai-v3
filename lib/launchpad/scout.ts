/**
 * Launchpad firehose helpers — shared by Helius webhook (Next) and docs.
 * Adapter in services/ingestion keeps a twin copy (no @/ imports there).
 */
import {
  namespacedSignalId,
  type UnifiedSignal,
} from '@cryptocheck/signal-contracts'

const DEDUP = new Set<string>()
const DEDUP_MAX = 5_000

function remember(mint: string): boolean {
  if (DEDUP.has(mint)) return false
  DEDUP.add(mint)
  if (DEDUP.size > DEDUP_MAX) {
    const first = DEDUP.values().next().value
    if (first) DEDUP.delete(first)
  }
  return true
}

/**
 * Liquidity / age / mint-shape gate. Does NOT include process-local mint remember —
 * webhook Redis SETNX is the durable replay guard; adapters call with `rememberMint: true`.
 */
export function mintPassesPrefilter(
  mint: string,
  meta: { liquidityUsd?: number; ageSec?: number },
  cfg: { minLiquidityUsd: number; minAgeSec: number },
  opts?: { rememberMint?: boolean },
): boolean {
  if (!mint || mint.length < 32) return false
  if (opts?.rememberMint !== false && !remember(mint)) return false
  if (meta.liquidityUsd != null && meta.liquidityUsd < cfg.minLiquidityUsd) return false
  if (meta.ageSec != null && meta.ageSec < cfg.minAgeSec) return false
  return true
}

export function buildLaunchpadSignal(input: {
  mint: string
  symbol?: string
  label?: string
  liquidityUsd?: number
  sourceRef?: string
}): UnifiedSignal {
  const now = new Date().toISOString()
  const sourceRef = input.sourceRef ?? `mint:${input.mint}`
  return {
    id: namespacedSignalId('launchpad', sourceRef),
    sourceTag: 'launchpad',
    sourceRef,
    subjectType: 'token',
    label: input.label ?? input.symbol ?? input.mint.slice(0, 6),
    type: 'mention',
    msgTimestamp: now,
    ingestTimestamp: now,
    confidence: 0.7,
    chain: 'solana',
    contractAddress: input.mint,
    tokenSymbol: input.symbol,
    verdict: 'scanning',
    rawPayload: {
      liquidity: input.liquidityUsd,
      firehose: true,
      platform: 'helius',
    },
    sources: ['launchpad', 'helius'],
    sourceCount: 2,
  }
}
