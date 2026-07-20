import {
  OVERRIDE_IGNORE_LOOKBACK,
  REVENGE_WINDOW_MS,
  WHIPLASH_WINDOW_MS,
} from './constants'
import type { OverrideLogEntry } from './coach-interrupt'
import type { TerminalTradeEntry } from './trade-log'

/**
 * Detectable behavior patterns (Prompt 4) — only from trade log + override log.
 * No fabricated psychology scores.
 */

export type BehaviorPatternId =
  | 'override_cluster'
  | 'whiplash_flip'
  | 'ignored_warning_streak'
  | 'rapid_reentry'
  | 'sell_then_rebuy'
  | 'sample_trading'

export type BehaviorFinding = {
  id: BehaviorPatternId
  title: string
  detail: string
  /** Evidence citations — always real counts/timestamps. */
  evidence: string[]
  tone: 'info' | 'warn'
}

export type BehaviorContext = {
  trades: TerminalTradeEntry[]
  overrides: OverrideLogEntry[]
  now?: number
}

export function detectBehaviorPatterns(ctx: BehaviorContext): BehaviorFinding[] {
  const now = ctx.now ?? Date.now()
  const findings: BehaviorFinding[] = []
  const trades = [...ctx.trades].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const overrides = [...ctx.overrides].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  // Override cluster: ≥3 overrides in 24h
  const dayAgo = now - 24 * 60 * 60 * 1000
  const recentOverrides = overrides.filter(
    (o) => o.action === 'overridden' && Date.parse(o.at) >= dayAgo,
  )
  if (recentOverrides.length >= 3) {
    findings.push({
      id: 'override_cluster',
      title: 'Override cluster',
      detail: `${recentOverrides.length} coach overrides in the last 24h. Soft gates are being skipped often.`,
      evidence: recentOverrides.slice(0, 3).map((o) => `${o.at.slice(0, 16)} ${o.triggers.join('+')}`),
      tone: 'warn',
    })
  }

  // Ignored warning streak: last N trades after override with HIGH_RISK/CAUTION at trade
  const overriddenTrades = trades
    .filter((t) => t.coachOverridden)
    .slice(0, OVERRIDE_IGNORE_LOOKBACK)
  const riskyIgnored = overriddenTrades.filter(
    (t) => t.verdictAtTrade === 'HIGH_RISK' || t.verdictAtTrade === 'CAUTION' || t.verdictAtTrade === 'BLOCKED',
  )
  if (riskyIgnored.length >= 2) {
    findings.push({
      id: 'ignored_warning_streak',
      title: 'Ignored warning streak',
      detail: `${riskyIgnored.length} recent fills after overriding CAUTION/HIGH_RISK. Outcome PnL not yet bound — count is from local trade log only.`,
      evidence: riskyIgnored.slice(0, 3).map((t) => `${t.at.slice(0, 16)} ${t.side} ${t.verdictAtTrade}`),
      tone: 'warn',
    })
  }

  // Whiplash: buy then sell (or reverse) same mint within 3m, ≥2 times in day
  let whiplashPairs = 0
  const whiplashEvidence: string[] = []
  for (let i = 0; i < trades.length - 1; i++) {
    const a = trades[i]!
    const b = trades[i + 1]!
    if (a.mint !== b.mint) continue
    if (a.side === b.side) continue
    const dt = Math.abs(Date.parse(a.at) - Date.parse(b.at))
    if (dt <= WHIPLASH_WINDOW_MS && Date.parse(a.at) >= dayAgo) {
      whiplashPairs++
      if (whiplashEvidence.length < 3) {
        whiplashEvidence.push(`${a.mint.slice(0, 6)}… ${a.side}↔${b.side} ${Math.round(dt / 1000)}s`)
      }
    }
  }
  if (whiplashPairs >= 2) {
    findings.push({
      id: 'whiplash_flip',
      title: 'Whiplash flips',
      detail: `${whiplashPairs} same-mint side flips within ${WHIPLASH_WINDOW_MS / 60000}m today.`,
      evidence: whiplashEvidence,
      tone: 'info',
    })
  }

  // Rapid reentry: second buy on same mint within revenge window after a sell
  let rapid = 0
  const rapidEv: string[] = []
  for (let i = 0; i < trades.length - 1; i++) {
    const newer = trades[i]!
    if (newer.side !== 'buy') continue
    for (let j = i + 1; j < trades.length; j++) {
      const older = trades[j]!
      if (older.mint !== newer.mint) continue
      if (older.side !== 'sell') continue
      const dt = Date.parse(newer.at) - Date.parse(older.at)
      if (dt >= 0 && dt <= REVENGE_WINDOW_MS) {
        rapid++
        if (rapidEv.length < 3) {
          rapidEv.push(`Re-buy ${Math.round(dt / 60000)}m after sell · ${newer.mint.slice(0, 6)}…`)
        }
      }
      break
    }
  }
  if (rapid >= 1) {
    findings.push({
      id: 'rapid_reentry',
      title: 'Rapid re-entry after sell',
      detail: `${rapid} buy(s) within ${REVENGE_WINDOW_MS / 60000}m of a sell on the same mint (revenge-window heuristic).`,
      evidence: rapidEv,
      tone: 'warn',
    })
  }

  // Sell then rebuy counted separately if we want sell_then_rebuy - merge into rapid_reentry for now

  // Sample trading: trades while verdict was INSUFFICIENT or sample not tracked — use override sample_data + trades
  const sampleOverrides = overrides.filter(
    (o) => o.action === 'overridden' && o.triggers.includes('sample_data'),
  )
  if (sampleOverrides.length >= 1 && trades.some((t) => t.coachOverridden)) {
    findings.push({
      id: 'sample_trading',
      title: 'Traded through sample gate',
      detail: `${sampleOverrides.length} sample-data override(s) in log. Confirm you are not sizing on sandbox scans.`,
      evidence: sampleOverrides.slice(0, 2).map((o) => o.at.slice(0, 19)),
      tone: 'warn',
    })
  }

  return findings
}
