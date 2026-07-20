/**
 * Personal watch + coach — continuous rescans of tokens users hold/watch.
 * Redis keys: ccai:rep:watch:* (never scan:v2:).
 */

/** Free tier rescan interval minutes (cron schedule should match). */
export const PERSONAL_WATCH_INTERVAL_MIN = Number(
  process.env.PERSONAL_WATCH_INTERVAL_MIN ?? 10,
)

/** Premium tier target rescan interval seconds (30–60s; cron runs every 1 min). */
export const PERSONAL_WATCH_PREMIUM_INTERVAL_SEC = Number(
  process.env.PERSONAL_WATCH_PREMIUM_INTERVAL_SEC ?? 45,
)

/** Free-tier watch alert delay — mirrors Alpha Feed SIGNAL_FREE_DELAY_MS. */
export const WATCH_FREE_DELAY_MS = Number(
  process.env.WATCH_FREE_DELAY_MS ?? process.env.SIGNAL_FREE_DELAY_MS ?? 90_000,
)

/** Max unique mints scanned per cron tick (cost control). */
export const PERSONAL_WATCH_MAX_MINTS_PER_TICK = Number(
  process.env.PERSONAL_WATCH_MAX_MINTS_PER_TICK ?? 80,
)

/** Premium tick scans held+watched mints for premium users only. */
export const PERSONAL_WATCH_PREMIUM_MAX_MINTS_PER_TICK = Number(
  process.env.PERSONAL_WATCH_PREMIUM_MAX_MINTS_PER_TICK ?? 40,
)

/** Min FeeRecords before a behavioral insight is allowed. */
export const COACH_MIN_TRADES_FOR_INSIGHT = 5

export const WATCH_SNAP_REDIS_PREFIX = 'ccai:rep:watch:snap:'
export const WATCH_EVENT_REDIS_PREFIX = 'ccai:rep:watch:event:'
export const WATCH_LAST_SCAN_REDIS_PREFIX = 'ccai:rep:watch:lastscan:'
export const GUARDIAN_KILL_REDIS_PREFIX = 'ccai:rep:guardian:killswitch:'
export const GUARDIAN_PENDING_REDIS_PREFIX = 'ccai:rep:guardian:pending:'

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

/** Coach UI view — free tier may blur/delay recent held DANGER alerts. */
export type CoachAlertView = WatchDegradeEvent & {
  blurred?: boolean
  delayed?: boolean
}

export type GuardianAutoExitStatus =
  | 'prepared'
  | 'aborted'
  | 'awaiting_signature'
  | 'completed'
  | 'failed'
  | 'killed'

export type GuardianAutoExitEvent = {
  id: string
  userId: string
  mint: string
  degradeEventId: string | null
  status: GuardianAutoExitStatus
  reason: string | null
  walletAddress: string | null
  inputAmount: number | null
  expectedOutputUsd: number | null
  priceImpactPct: number | null
  slippageBps: number | null
  txSignature: string | null
  platformFeeBps: number | null
  createdAt: string
  completedAt: string | null
}

export type GuardianAutoExitConfig = {
  enabled: boolean
  maxSlippageBps: number
  minProceedsRatio: number
  authorizedWallet: string | null
  authorizedAt: string | null
  globalDefault: boolean
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
