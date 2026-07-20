import { WORKSPACE_STORAGE_KEY } from './constants'
import { detectBehaviorPatterns } from './behavior'
import { loadOverrideLog, summarizeOverrideLog, type OverrideLogSummary } from './coach-interrupt'
import { loadTradeLog } from './trade-log'
import { loadWatchlists } from './watchlist-storage'
import { loadWorkspace } from './workspace-storage'

/**
 * Weekly Intelligence Brief — only sections computable from local terminal data.
 * No fabricated smart-money or launch retrospectives.
 */

export type BriefSectionStatus = 'ready' | 'unavailable'

export type BriefSection = {
  id: string
  title: string
  status: BriefSectionStatus
  /** Honest body — never pad with fake metrics. */
  lines: string[]
}

export type WeeklyBriefPayload = {
  briefNumber: number
  generatedAt: string
  weekStartIso: string
  sections: BriefSection[]
  summary: OverrideLogSummary
}

export function startOfUtcWeek(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay() || 7
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1))
  return x.toISOString()
}

/** Deterministic brief # from week start (not marketing theater). */
export function briefNumberFromWeekStart(weekStartIso: string): number {
  const t = Date.parse(weekStartIso)
  if (!Number.isFinite(t)) return 1
  // Weeks since 2026-01-05 (first Monday of 2026)
  const epoch = Date.UTC(2026, 0, 5)
  return Math.max(1, Math.floor((t - epoch) / (7 * 24 * 60 * 60 * 1000)) + 1)
}

export function buildWeeklyBrief(now = new Date()): WeeklyBriefPayload {
  const weekStartIso = startOfUtcWeek(now)
  const log = loadOverrideLog()
  const trades = loadTradeLog()
  const summary = summarizeOverrideLog(log, weekStartIso)
  const behavior = detectBehaviorPatterns({ trades, overrides: log, now: now.getTime() })
  const wl = loadWatchlists()
  const ws = loadWorkspace()
  const watchCount = wl.lists.reduce((n, l) => n + l.items.length, 0)

  const personalLines: string[] = []
  if (summary.sinceCount === 0) {
    personalLines.push('No coach interrupt actions logged this week yet.')
  } else {
    personalLines.push(
      `${summary.sinceCount} coach action(s) this week · ${summary.sinceOverridden} override(s), ${summary.muted} mute(s) all-time in log window.`,
    )
  }
  personalLines.push(
    `Local confirmed trades: ${trades.length}. Behavior findings: ${behavior.length}.`,
  )
  personalLines.push(
    `Watchlists: ${wl.lists.length} list(s), ${watchCount} token(s).`,
  )
  if (ws?.updatedAt) {
    personalLines.push(`Workspace last saved ${ws.updatedAt}.`)
  } else {
    personalLines.push('Workspace not yet persisted this browser.')
  }

  const sections: BriefSection[] = [
    {
      id: 'personal',
      title: 'Personal performance',
      status: 'ready',
      lines: personalLines,
    },
    {
      id: 'smart_money',
      title: 'Smart-money summary',
      status: 'unavailable',
      lines: [
        'Not bound to this terminal yet. Whale intel stays on existing Insider Whale surfaces — no fabricated summary here.',
      ],
    },
    {
      id: 'launch_retro',
      title: 'Launch retrospective',
      status: 'unavailable',
      lines: [
        'Requires timestamped verdict→outcome windows (V3 track-record outcomes). Override log alone is not an outcome.',
      ],
    },
    {
      id: 'shipped',
      title: 'What shipped in Terminal',
      status: 'ready',
      lines: [
        'Single-screen Discover · multi-chart · Coach verdict · risk-gated ticket.',
        'Workspace + watchlist persistence (local).',
        'Coach interrupt ladder with auditable override log.',
        'Behavior patterns from local trade + override logs; sniper arm with live risk abort.',
        'Trade marks (DexScreener price Δ) — withheld without entry mark.',
        `Storage key workspace: ${WORKSPACE_STORAGE_KEY}`,
      ],
    },
  ]

  return {
    briefNumber: briefNumberFromWeekStart(weekStartIso),
    generatedAt: now.toISOString(),
    weekStartIso,
    sections,
    summary,
  }
}
