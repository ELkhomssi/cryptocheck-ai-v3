import { randomUUID } from 'node:crypto'
import type {
  SnipeActionRecord,
  SnipeCandidate,
  UnifiedSignal,
} from '@cryptocheck/signal-contracts'
import type { SniperConfig } from './config.js'
import { logSnipeAction } from './persist.js'
import { scanMint } from './scanner-client.js'
import { emitCandidate } from './stream.js'

export type SniperStats = {
  startedAt: string
  seen: number
  triggered: number
  scanned: number
  blocked: number
  candidates: number
  errors: number
  lastCandidateAt: string | null
}

export function newStats(): SniperStats {
  return {
    startedAt: new Date().toISOString(),
    seen: 0,
    triggered: 0,
    scanned: 0,
    blocked: 0,
    candidates: 0,
    errors: 0,
    lastCandidateAt: null,
  }
}

/** A token signal is a snipe trigger only if it has a resolvable mint. */
function isTrigger(sig: UnifiedSignal, cfg: SniperConfig): boolean {
  if (sig.subjectType !== 'token') return false
  if (sig.dropped || sig.sample) return false
  const mint = sig.contractAddress?.trim()
  if (!mint) return false
  return cfg.triggerTypes.includes(String(sig.type).toLowerCase())
}

async function audit(row: SnipeActionRecord): Promise<void> {
  try {
    await logSnipeAction(row)
  } catch (e) {
    console.warn('[signal-sniper] audit failed', e instanceof Error ? e.message : e)
  }
}

/**
 * Detect → scan (kill-switch) → threshold → emit candidate.
 * Non-custodial: this NEVER signs or sends. Per-user arming + Phantom signing
 * happens at the execution layer that consumes the candidate stream.
 */
export async function processSignal(
  sig: UnifiedSignal,
  cfg: SniperConfig,
  stats: SniperStats,
): Promise<void> {
  stats.seen += 1
  if (!isTrigger(sig, cfg)) return

  stats.triggered += 1
  const mint = sig.contractAddress!.trim()
  const symbol = sig.tokenSymbol || sig.label || mint.slice(0, 6)

  const report = await scanMint(cfg.scannerUrl, mint, cfg.scanTimeoutMs)
  stats.scanned += 1

  if (cfg.logAllScans) {
    await audit({
      id: randomUUID(),
      signalId: sig.id,
      mint,
      symbol,
      action: 'scan',
      allowed: report.safeToSnipe,
      neuralScore: report.neuralScore,
      verdict: report.verdict,
      redFlags: report.redFlags,
      evidenceSummary: report.evidenceSummary,
      createdAt: new Date().toISOString(),
    })
  }

  // HARD kill-switch: a single red flag or unresolved scan blocks the buy,
  // regardless of score.
  if (!report.safeToSnipe) {
    stats.blocked += 1
    await audit({
      id: randomUUID(),
      signalId: sig.id,
      mint,
      symbol,
      action: 'blocked',
      allowed: false,
      neuralScore: report.neuralScore,
      verdict: report.verdict,
      redFlags: report.redFlags,
      evidenceSummary: report.evidenceSummary,
      blockedReason:
        report.redFlags.length > 0 ? report.redFlags.join(', ') : 'kill-switch (unsafe)',
      createdAt: new Date().toISOString(),
    })
    console.info('[signal-sniper] blocked', { mint, symbol, redFlags: report.redFlags })
    return
  }

  // Conviction threshold — safe but low-quality tokens are not auto-surfaced.
  if (report.neuralScore < cfg.minScore) {
    console.info('[signal-sniper] below threshold', {
      mint,
      symbol,
      score: report.neuralScore,
      min: cfg.minScore,
    })
    return
  }

  const candidate: SnipeCandidate = {
    id: sig.id,
    mint,
    symbol,
    chain: sig.chain || 'solana',
    sourceTag: sig.sourceTag,
    neuralScore: report.neuralScore,
    riskScore: report.riskScore,
    verdict: report.verdict,
    safeToSnipe: true,
    redFlags: report.redFlags,
    evidenceSummary: report.evidenceSummary,
    detectedAt: new Date().toISOString(),
    scanLatencyMs: report.latencyMs,
  }

  await emitCandidate(candidate)
  stats.candidates += 1
  stats.lastCandidateAt = candidate.detectedAt

  await audit({
    id: randomUUID(),
    signalId: sig.id,
    mint,
    symbol,
    action: 'candidate',
    allowed: true,
    neuralScore: report.neuralScore,
    verdict: report.verdict,
    redFlags: report.redFlags,
    evidenceSummary: report.evidenceSummary,
    createdAt: candidate.detectedAt,
  })
  console.info('[signal-sniper] candidate', {
    mint,
    symbol,
    score: report.neuralScore,
    verdict: report.verdict,
  })
}
