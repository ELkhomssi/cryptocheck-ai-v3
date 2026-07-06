/**
 * Per-match rolling window for latency / velocity / model detectors.
 * In-process only (MVP) — each gate worker maintains its own view.
 */

export type OddsTick = {
  ts: number
  decimalOdds: number
  impliedProb: number
  market?: string
}

export type ScoreEventTick = {
  ts: number
  type: string
  score?: { home: number; away: number }
}

export type MatchWindow = {
  matchId: string
  ticks: OddsTick[]
  /** First observed decimal odds = opening / model baseline. */
  openingOdds?: number
  openingProb?: number
  lastScoreEvent?: ScoreEventTick
  lastScore?: { home: number; away: number }
  updatedAt: number
}

const WINDOW_MS = Number(process.env.SIGNAL_EDGE_WINDOW_MS ?? 120_000)
const MAX_TICKS = Number(process.env.SIGNAL_EDGE_MAX_TICKS ?? 80)
const MAX_MATCHES = Number(process.env.SIGNAL_EDGE_MAX_MATCHES ?? 500)

const windows = new Map<string, MatchWindow>()

function pruneTicks(ticks: OddsTick[], now: number): OddsTick[] {
  const cutoff = now - WINDOW_MS
  const kept = ticks.filter((t) => t.ts >= cutoff)
  return kept.length > MAX_TICKS ? kept.slice(-MAX_TICKS) : kept
}

function touchMatch(matchId: string, now: number): MatchWindow {
  let w = windows.get(matchId)
  if (!w) {
    w = { matchId, ticks: [], updatedAt: now }
    windows.set(matchId, w)
    if (windows.size > MAX_MATCHES) {
      // Drop oldest
      let oldestId: string | null = null
      let oldestTs = Infinity
      for (const [id, mw] of windows) {
        if (mw.updatedAt < oldestTs) {
          oldestTs = mw.updatedAt
          oldestId = id
        }
      }
      if (oldestId) windows.delete(oldestId)
    }
  }
  w.updatedAt = now
  return w
}

export function getMatchWindow(matchId: string): MatchWindow | undefined {
  return windows.get(matchId)
}

export function recordOddsTick(
  matchId: string,
  tick: OddsTick,
): MatchWindow {
  const w = touchMatch(matchId, tick.ts)
  if (w.openingOdds == null) {
    w.openingOdds = tick.decimalOdds
    w.openingProb = tick.impliedProb
  }
  w.ticks.push(tick)
  w.ticks = pruneTicks(w.ticks, tick.ts)
  return w
}

export function recordScoreEvent(
  matchId: string,
  event: ScoreEventTick,
): MatchWindow {
  const w = touchMatch(matchId, event.ts)
  w.lastScoreEvent = event
  if (event.score) w.lastScore = event.score
  return w
}

/** Test / backtest harness — clear all windows. */
export function resetMatchWindows(): void {
  windows.clear()
}

/** Test / backtest — inject a full window. */
export function seedMatchWindow(window: MatchWindow): void {
  windows.set(window.matchId, { ...window, ticks: [...window.ticks] })
}
