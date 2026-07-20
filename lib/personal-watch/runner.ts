import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { toRevenueVerdict } from '@/lib/revenue-dashboard/types'
import { redis } from '@/lib/cache/redis'
import {
  PERSONAL_WATCH_MAX_MINTS_PER_TICK,
  PERSONAL_WATCH_PREMIUM_INTERVAL_SEC,
  PERSONAL_WATCH_PREMIUM_MAX_MINTS_PER_TICK,
  WATCH_LAST_SCAN_REDIS_PREFIX,
  type TokenWatchSnapshot,
} from './constants'
import { detectDegrade, uniqueMintCount } from './degrade'
import { insertWatchDegradeEvent } from './events'
import { maybePrepareGuardianAutoExit } from './guardian-auto-exit'
import { collectMintUniverse, type MintUniverse } from './mint-universe'
import { filterPremiumMintUniverse } from './premium-universe'
import { dispatchWatchDegradePush, dispatchGuardianExitPush } from './push'
import { readTokenSnapshot, writeTokenSnapshot } from './snapshot-store'

export type PersonalWatchTickMode = 'free' | 'premium'

export type PersonalWatchRunResult = {
  mode: PersonalWatchTickMode
  uniqueMints: number
  watchlistRows: number
  portfolioMints: number
  premiumUsers?: number
  skippedRecent?: number
  /** Gateway calls this tick — must equal uniqueMints (capped), never user×mint. */
  scansExecuted: number
  degraded: number
  eventsEmitted: number
  pushesSent: number
  guardianPrepared: number
  failures: Array<{ mint: string; reason: string }>
}

function lastScanKey(mint: string): string {
  return `${WATCH_LAST_SCAN_REDIS_PREFIX}${mint}`
}

async function shouldSkipPremiumRescan(mint: string): Promise<boolean> {
  try {
    const raw = await redis.get(lastScanKey(mint))
    if (!raw) return false
    const last = Number(raw)
    if (!Number.isFinite(last)) return false
    return Date.now() - last < PERSONAL_WATCH_PREMIUM_INTERVAL_SEC * 1000
  } catch {
    return false
  }
}

async function markMintScanned(mint: string): Promise<void> {
  try {
    await redis.setex(lastScanKey(mint), PERSONAL_WATCH_PREMIUM_INTERVAL_SEC * 2, String(Date.now()))
  } catch {
    /* best-effort */
  }
}

async function processMintWatch(input: {
  mint: string
  universe: MintUniverse
  counters: {
    scansExecuted: number
    degraded: number
    eventsEmitted: number
    pushesSent: number
    guardianPrepared: number
  }
  failures: Array<{ mint: string; reason: string }>
}): Promise<void> {
  const { mint, universe, counters, failures } = input

  try {
    // ~150–400ms estimated per mint (fast gateway)
    const assessment = await assessRiskByMint(mint, 'solana', 'fast')
    counters.scansExecuted += 1
    await markMintScanned(mint)

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

    if (!prev) return

    const { degraded: isDeg, reason } = detectDegrade({
      prevVerdict: prev.verdict,
      newVerdict,
      prevLabels: prev.evidenceLabels,
      newLabels: labels,
      prevEvidenceLine: prev.evidenceLine,
      newEvidenceLine: evidenceLine,
    })
    if (!isDeg) return
    counters.degraded += 1

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
      counters.eventsEmitted += 1
      const push = await dispatchWatchDegradePush(event)
      counters.pushesSent += push.sent

      const guardian = await maybePrepareGuardianAutoExit(event)
      if (guardian.prepared && guardian.eventId) {
        counters.guardianPrepared += 1
        await dispatchGuardianExitPush(event.userId, event.mint, guardian.eventId)
      }
    }
  } catch (e) {
    failures.push({
      mint,
      reason: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * Continuous personal-watch tick.
 * - free: all unique mints, 10-min cron
 * - premium: premium-user mints only, ~45s throttle via Redis last-scan
 */
export async function runPersonalWatchTick(
  mode: PersonalWatchTickMode = 'free',
): Promise<PersonalWatchRunResult> {
  const baseUniverse = await collectMintUniverse()
  let universe = baseUniverse
  let premiumUsers: number | undefined
  let skippedRecent = 0

  let mints: string[]
  let cap: number

  if (mode === 'premium') {
    const filtered = await filterPremiumMintUniverse(baseUniverse)
    universe = {
      ...baseUniverse,
      mintToUsers: filtered.mintToUsers,
      heldMints: filtered.heldMints,
    }
    premiumUsers = filtered.premiumUserCount
    cap = PERSONAL_WATCH_PREMIUM_MAX_MINTS_PER_TICK
    const candidates = Array.from(filtered.mintToUsers.keys())
    mints = []
    for (const mint of candidates) {
      if (mints.length >= cap) break
      if (await shouldSkipPremiumRescan(mint)) {
        skippedRecent += 1
        continue
      }
      mints.push(mint)
    }
  } else {
    cap = PERSONAL_WATCH_MAX_MINTS_PER_TICK
    mints = Array.from(baseUniverse.mintToUsers.keys()).slice(0, cap)
  }

  const unique = uniqueMintCount(universe.mintToUsers)
  const counters = {
    scansExecuted: 0,
    degraded: 0,
    eventsEmitted: 0,
    pushesSent: 0,
    guardianPrepared: 0,
  }
  const failures: Array<{ mint: string; reason: string }> = []

  for (const mint of mints) {
    await processMintWatch({ mint, universe, counters, failures })
  }

  console.info(
    '[personal-watch] tick',
    JSON.stringify({
      mode,
      uniqueMints: unique,
      scannedThisTick: counters.scansExecuted,
      skippedRecent,
      premiumUsers,
      watchlistRows: universe.watchlistRows,
      costNote: 'scansExecuted scales with unique mints, not user×mint pairs',
      ...counters,
    }),
  )

  return {
    mode,
    uniqueMints: unique,
    watchlistRows: universe.watchlistRows,
    portfolioMints: universe.portfolioMints,
    premiumUsers,
    skippedRecent,
    scansExecuted: counters.scansExecuted,
    degraded: counters.degraded,
    eventsEmitted: counters.eventsEmitted,
    pushesSent: counters.pushesSent,
    guardianPrepared: counters.guardianPrepared,
    failures,
  }
}

/** Event-driven rescan for a single mint (Helius webhook / manual trigger). */
export async function rescanMintForWatch(mint: string): Promise<{
  scanned: boolean
  degraded: boolean
}> {
  const trimmed = mint.trim()
  if (trimmed.length < 32) return { scanned: false, degraded: false }

  const baseUniverse = await collectMintUniverse()
  if (!baseUniverse.mintToUsers.has(trimmed)) {
    return { scanned: false, degraded: false }
  }

  const counters = {
    scansExecuted: 0,
    degraded: 0,
    eventsEmitted: 0,
    pushesSent: 0,
    guardianPrepared: 0,
  }
  const failures: Array<{ mint: string; reason: string }> = []
  const before = counters.degraded

  await processMintWatch({
    mint: trimmed,
    universe: baseUniverse,
    counters,
    failures,
  })

  return {
    scanned: counters.scansExecuted > 0,
    degraded: counters.degraded > before,
  }
}
