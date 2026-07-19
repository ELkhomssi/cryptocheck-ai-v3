/**
 * Personal watch + coach — continuous rescans of tokens users hold/watch.
 * Redis keys: ccai:rep:watch:* (never scan:v2:).
 */

/** Default rescan interval minutes (cron schedule should match). */
export const PERSONAL_WATCH_INTERVAL_MIN = Number(
  process.env.PERSONAL_WATCH_INTERVAL_MIN ?? 10,
)

/** Max unique mints scanned per cron tick (cost control). */
export const PERSONAL_WATCH_MAX_MINTS_PER_TICK = Number(
  process.env.PERSONAL_WATCH_MAX_MINTS_PER_TICK ?? 80,
)

/** Min FeeRecords before a behavioral insight is allowed. */
export const COACH_MIN_TRADES_FOR_INSIGHT = 5

export const WATCH_SNAP_REDIS_PREFIX = 'ccai:rep:watch:snap:'
export const WATCH_EVENT_REDIS_PREFIX = 'ccai:rep:watch:event:'

export type CoachVerdict = 'SAFE' | 'CAUTION' | 'DANGER'

export type WatchDegradeEvent = {
  id: string
  userId: string
  mint: string
  prevVerdict: CoachVerdict
  newVerdict: CoachVerdict
  prevRisk: number | null
  newRisk: number | null
  reason: string
  held: boolean
  ts: string
}

export type TokenWatchSnapshot = {
  mint: string
  safetyScore: number
  riskScore: number
  verdict: CoachVerdict
  evidenceLabels: string[]
  evidenceLine: string | null
  scannedAt: string
}

export type CitedTrade = {
  feeRecordId: string
  signature: string
  mint: string
  executedAt: string
  volumeUsd: number
  entryVerdict: CoachVerdict | 'unknown'
  entrySafetyScore: number | null
}

export type CoachInsight = {
  id: string
  kind: 'entry_timing' | 'verdict_pnl' | 'holding_period'
  /** Observable pattern only — never a psychological label. */
  summary: string
  /** Specific FeeRecords behind the claim. */
  citedTrades: CitedTrade[]
  sampleSize: number
}

export type CoachWeeklySummary = {
  savesThisWeek: number
  patternsFlagged: number
  degradeAlertsThisWeek: number
  line: string
}
