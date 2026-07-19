import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { toRevenueVerdict } from '@/lib/revenue-dashboard/types'
import {
  PERSONAL_WATCH_MAX_MINTS_PER_TICK,
  type TokenWatchSnapshot,
} from './constants'
import { detectDegrade, uniqueMintCount } from './degrade'
import { insertWatchDegradeEvent } from './events'
import { collectMintUniverse } from './mint-universe'
import { dispatchWatchDegradePush } from './push'
import { readTokenSnapshot, writeTokenSnapshot } from './snapshot-store'

export type PersonalWatchRunResult = {
  uniqueMints: number
  watchlistRows: number
  portfolioMints: number
  /** Gateway calls this tick — must equal uniqueMints (capped), never user×mint. */
  scansExecuted: number
  degraded: number
  eventsEmitted: number
  pushesSent: number
  failures: Array<{ mint: string; reason: string }>
}

/**
 * Continuous personal-watch tick:
 * 1) UNION watchlist + portfolio holdings → unique mints
 * 2) One gateway scan per mint
 * 3) Compare to last snapshot → emit WatchDegradeEvent per watching user
 */
export async function runPersonalWatchTick(): Promise<PersonalWatchRunResult> {
  const universe = await collectMintUniverse()
  const unique = uniqueMintCount(universe.mintToUsers)
  const mints = Array.from(universe.mintToUsers.keys()).slice(0, PERSONAL_WATCH_MAX_MINTS_PER_TICK)

  let scansExecuted = 0
  let degraded = 0
  let eventsEmitted = 0
  let pushesSent = 0
  const failures: Array<{ mint: string; reason: string }> = []

  for (const mint of mints) {
    try {
      // ~150–400ms estimated per mint (fast gateway)
      const assessment = await assessRiskByMint(mint, 'solana', 'fast')
      scansExecuted += 1

      const labels = assessment.snapshot.reasoning.evidence
        .slice(0, 10)
        .map((e) => e.label)
      const evidenceLine =
        assessment.snapshot.reasoning.evidence[0]?.detail ??
        assessment.snapshot.reasoning.clusterAnalysis.summary ??
        null
      const newVerdict = toRevenueVerdict(assessment.verdict)

      const nextSnap: TokenWatchSnapshot = {
        mint,
        safetyScore: assessment.safetyScore,
        riskScore: assessment.riskScore,
        verdict: newVerdict,
        evidenceLabels: labels,
        evidenceLine,
        scannedAt: new Date().toISOString(),
      }

      const prev = await readTokenSnapshot(mint)
      await writeTokenSnapshot(nextSnap)

      if (!prev) continue

      const { degraded: isDeg, reason } = detectDegrade({
        prevVerdict: prev.verdict,
        newVerdict,
        prevLabels: prev.evidenceLabels,
        newLabels: labels,
        prevEvidenceLine: prev.evidenceLine,
        newEvidenceLine: evidenceLine,
      })
      if (!isDeg) continue
      degraded += 1

      const users = universe.mintToUsers.get(mint) ?? new Set<string>()
      const held = universe.heldMints.has(mint)

      for (const userId of users) {
        const event = await insertWatchDegradeEvent({
          userId,
          mint,
          prevVerdict: prev.verdict,
          newVerdict,
          prevRisk: prev.riskScore,
          newRisk: assessment.riskScore,
          reason,
          held,
        })
        if (!event) continue
        eventsEmitted += 1
        const push = await dispatchWatchDegradePush(event)
        pushesSent += push.sent
      }
    } catch (e) {
      failures.push({
        mint,
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.info(
    '[personal-watch] tick',
    JSON.stringify({
      uniqueMints: unique,
      scannedThisTick: scansExecuted,
      watchlistRows: universe.watchlistRows,
      costNote: 'scansExecuted scales with unique mints, not user×mint pairs',
      degraded,
      eventsEmitted,
      pushesSent,
    }),
  )

  return {
    uniqueMints: unique,
    watchlistRows: universe.watchlistRows,
    portfolioMints: universe.portfolioMints,
    scansExecuted,
    degraded,
    eventsEmitted,
    pushesSent,
    failures,
  }
}
