/**
 * PROMPT 22 — Terminal Alerts Engine
 *
 * Pure, client-safe aggregator for the intelligence column "Recent Intelligence".
 * Demo: DEMO_SEED intel events (labeled). Live: portfolio threats / risk only —
 * never fabricates market moves when feeds are missing.
 */

import type { IntelEvent } from '../data/types'
import type { LivePortfolioBrain } from '../live-portfolio-brain'
import type { Opportunity } from './opportunity-engine'
import type { CoachNudge } from './wallet-coach'

export type TerminalAlertSeverity = 'info' | 'watch' | 'high' | 'critical'

export type TerminalAlertSource =
  | 'demo-intel'
  | 'portfolio-threat'
  | 'opportunity'
  | 'coach-nudge'
  | 'risk-change'

export type TerminalAlert = {
  id: string
  severity: TerminalAlertSeverity
  headline: string
  detail: string
  mint: string | null
  symbol: string | null
  at: string
  source: TerminalAlertSource
  actionable: boolean
}

export type AlertPrefs = {
  /** Hide info-level noise */
  minSeverity: TerminalAlertSeverity
  mutedMints: string[]
}

const SEVERITY_RANK: Record<TerminalAlertSeverity, number> = {
  info: 0,
  watch: 1,
  high: 2,
  critical: 3,
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  minSeverity: 'info',
  mutedMints: [],
}

const INTEL_SEVERITY: Record<IntelEvent['kind'], TerminalAlertSeverity> = {
  smart_money_buy: 'watch',
  smart_money_sell: 'high',
  new_pool: 'info',
  whale_accumulation: 'watch',
  risk_score_change: 'high',
  large_buy: 'watch',
  large_sell: 'high',
}

function fromIntel(events: IntelEvent[]): TerminalAlert[] {
  return events.map((e) => ({
    id: `intel:${e.id}`,
    severity: INTEL_SEVERITY[e.kind] ?? 'info',
    headline: e.headline,
    detail: e.detail,
    mint: e.mint,
    symbol: e.symbol,
    at: e.at,
    source: 'demo-intel' as const,
    actionable: Boolean(e.mint),
  }))
}

function fromThreats(brain: LivePortfolioBrain | null, nowIso: string): TerminalAlert[] {
  if (!brain) return []
  return brain.threats.map((t) => ({
    id: `threat:${t.mint}`,
    severity: (t.severity === 'HIGH' ? 'critical' : 'high') as TerminalAlertSeverity,
    headline: `${t.symbol} threat — ${t.severity}`,
    detail: t.reason,
    mint: t.mint,
    symbol: t.symbol,
    at: nowIso,
    source: 'portfolio-threat' as const,
    actionable: true,
  }))
}

function fromOpportunities(opps: Opportunity[], nowIso: string): TerminalAlert[] {
  return opps
    .filter((o) => o.convictionScore >= 75 && o.confidencePct >= 60)
    .slice(0, 3)
    .map((o) => ({
      id: `opp:${o.mint}`,
      severity: 'watch' as const,
      headline: `Setup: ${o.symbol} · conviction ${o.convictionScore}`,
      detail: o.whyNow,
      mint: o.mint,
      symbol: o.symbol,
      at: nowIso,
      source: 'opportunity' as const,
      actionable: true,
    }))
}

function fromNudges(nudges: CoachNudge[], nowIso: string): TerminalAlert[] {
  return nudges
    .filter((n) => n.kind === 'defense')
    .map((n) => ({
      id: `nudge:${n.id}`,
      severity: (n.suggestedAction === 'EXIT' ? 'high' : 'watch') as TerminalAlertSeverity,
      headline: n.message.slice(0, 96),
      detail: n.evidence.join(' · '),
      mint: n.mint,
      symbol: n.symbol,
      at: nowIso,
      source: 'coach-nudge' as const,
      actionable: true,
    }))
}

/** Apply prefs: severity floor + muted mints. */
export function filterAlerts(alerts: TerminalAlert[], prefs: AlertPrefs = DEFAULT_ALERT_PREFS): TerminalAlert[] {
  const floor = SEVERITY_RANK[prefs.minSeverity]
  const muted = new Set(prefs.mutedMints)
  return alerts.filter((a) => {
    if (SEVERITY_RANK[a.severity] < floor) return false
    if (a.mint && muted.has(a.mint)) return false
    return true
  })
}

/**
 * Build ranked terminal alerts.
 * Demo may pass intelEvents; live should pass [] for intel (honest empty market feed).
 */
export function buildTerminalAlerts(input: {
  intelEvents?: IntelEvent[]
  brain?: LivePortfolioBrain | null
  opportunities?: Opportunity[]
  nudges?: CoachNudge[]
  prefs?: AlertPrefs
  now?: number
}): TerminalAlert[] {
  const nowIso = new Date(input.now ?? Date.now()).toISOString()
  const merged: TerminalAlert[] = [
    ...fromIntel(input.intelEvents ?? []),
    ...fromThreats(input.brain ?? null, nowIso),
    ...fromOpportunities(input.opportunities ?? [], nowIso),
    ...fromNudges(input.nudges ?? [], nowIso),
  ]

  // Dedupe by mint+source keeping highest severity
  const byKey = new Map<string, TerminalAlert>()
  for (const a of merged) {
    const key = `${a.source}:${a.mint ?? a.id}`
    const prev = byKey.get(key)
    if (!prev || SEVERITY_RANK[a.severity] > SEVERITY_RANK[prev.severity]) {
      byKey.set(key, a)
    }
  }

  const ranked = [...byKey.values()].sort((a, b) => {
    const sd = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (sd !== 0) return sd
    return Date.parse(b.at) - Date.parse(a.at)
  })

  return filterAlerts(ranked, input.prefs ?? DEFAULT_ALERT_PREFS).slice(0, 12)
}
