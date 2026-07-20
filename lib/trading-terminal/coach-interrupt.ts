import type { ScanResult } from '@/lib/revenue-dashboard/types'
import {
  COACH_MUTES_STORAGE_KEY,
  COACH_MUTE_TTL_MS,
  COACH_OVERRIDE_LOG_KEY,
  CONCENTRATION_INTERRUPT_PCT,
} from './constants'
import { scanToVerdictCard } from './map-verdict'
import type { TerminalVerdict } from './types'

/**
 * Coach pre-trade interrupt ladder (Prompt 4/5).
 * Soft = one-key override, logged. Hard = no override (align risk-gated-swap BLOCKED).
 * Every trigger cites a real field — no fabricated urgency.
 */

export type InterruptSeverity = 'hard' | 'soft'

export type InterruptTriggerId =
  | 'blocked'
  | 'high_risk'
  | 'insufficient_data'
  | 'sample_data'
  | 'concentration'
  | 'caution_buy'

export type CoachInterrupt = {
  id: InterruptTriggerId
  severity: InterruptSeverity
  title: string
  detail: string
  /** Provenance — UI shows this; never invent. */
  source: string
  /** When true, submit path must stay disabled even after override. */
  blocksSubmit: boolean
}

export type InterruptContext = {
  scan: ScanResult | null
  ticketSide: 'buy' | 'sell'
  /** Position value / portfolio total * 100 when known. */
  positionConcentrationPct: number | null
  muted: Partial<Record<InterruptTriggerId, number>>
  now?: number
}

function cautionDetail(card: {
  why: { text: string; source: string }[]
  risks: { text: string }[]
}): string {
  return card.why[0]?.text || card.risks[0]?.text || 'Gateway CAUTION — review evidence before sizing up.'
}

export function evaluateCoachInterrupts(ctx: InterruptContext): CoachInterrupt[] {
  const now = ctx.now ?? Date.now()
  const out: CoachInterrupt[] = []
  const muted = (id: InterruptTriggerId) => {
    const exp = ctx.muted[id]
    return typeof exp === 'number' && exp > now
  }

  const card = scanToVerdictCard(ctx.scan)
  if (!card) return out

  const push = (i: CoachInterrupt) => {
    if (i.severity === 'soft' && muted(i.id)) return
    out.push(i)
  }

  if (card.verdict === 'BLOCKED' || (card.riskScore != null && card.riskScore >= 80)) {
    push({
      id: 'blocked',
      severity: 'hard',
      title: 'BLOCKED — swap disabled',
      detail: `Risk score ${card.riskScore ?? '—'}/100. Hard block from risk engine — no override.`,
      source: 'scan.riskScore / gateway BLOCKED',
      blocksSubmit: true,
    })
  } else if (card.verdict === 'HIGH_RISK' && ctx.ticketSide === 'buy') {
    push({
      id: 'high_risk',
      severity: 'soft',
      title: 'HIGH RISK — confirm before buy',
      detail: card.risks[0]?.text || card.why[0]?.text || 'Gateway mapped DANGER below hard-block threshold.',
      source: card.risks[0]?.source || 'scan.verdict',
      blocksSubmit: false,
    })
  } else if (card.verdict === 'CAUTION' && ctx.ticketSide === 'buy' && (card.riskScore ?? 0) >= 50) {
    push({
      id: 'caution_buy',
      severity: 'soft',
      title: 'CAUTION on buy',
      detail: cautionDetail(card),
      source: card.why[0]?.source || 'scan.verdict',
      blocksSubmit: false,
    })
  }

  if (card.verdict === 'INSUFFICIENT_DATA' && ctx.ticketSide === 'buy') {
    push({
      id: 'insufficient_data',
      severity: 'soft',
      title: 'Insufficient evidence',
      detail: `Evidence ${card.evidence.present.length}/${card.evidence.required.length}. Verdict withheld from incomplete coverage — not a SAFE.`,
      source: 'scan evidence coverage',
      blocksSubmit: false,
    })
  }

  if (card.sample) {
    push({
      id: 'sample_data',
      severity: 'soft',
      title: 'Sample / sandbox scan',
      detail: 'This scan is tagged sample. Do not treat as live mainnet risk.',
      source: 'scan.sample',
      blocksSubmit: false,
    })
  }

  if (
    ctx.ticketSide === 'buy' &&
    ctx.positionConcentrationPct != null &&
    ctx.positionConcentrationPct >= CONCENTRATION_INTERRUPT_PCT
  ) {
    push({
      id: 'concentration',
      severity: 'soft',
      title: 'High book concentration',
      detail: `This mint is already ~${ctx.positionConcentrationPct.toFixed(0)}% of portfolio value (≥${CONCENTRATION_INTERRUPT_PCT}%).`,
      source: 'portfolio position / totalValueUsd',
      blocksSubmit: false,
    })
  }

  out.sort((a, b) =>
    a.severity === 'hard' && b.severity !== 'hard'
      ? -1
      : a.severity !== 'hard' && b.severity === 'hard'
        ? 1
        : 0,
  )
  return out
}

export type OverrideLogEntry = {
  at: string
  mint: string
  side: 'buy' | 'sell'
  triggers: InterruptTriggerId[]
  action: 'overridden' | 'muted' | 'dismissed'
  verdict: TerminalVerdict | null
}

export function loadMutes(): Partial<Record<InterruptTriggerId, number>> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(COACH_MUTES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    const now = Date.now()
    const next: Partial<Record<InterruptTriggerId, number>> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && v > now) next[k as InterruptTriggerId] = v
    }
    return next
  } catch {
    return {}
  }
}

export function saveMute(id: InterruptTriggerId, ttlMs = COACH_MUTE_TTL_MS): void {
  if (typeof window === 'undefined') return
  if (id === 'blocked') return
  const cur = loadMutes()
  cur[id] = Date.now() + ttlMs
  try {
    window.localStorage.setItem(COACH_MUTES_STORAGE_KEY, JSON.stringify(cur))
  } catch {
    /* ignore */
  }
}

export function appendOverrideLog(entry: OverrideLogEntry): void {
  if (typeof window === 'undefined') return
  try {
    const prev = loadOverrideLog()
    const next = [entry, ...prev].slice(0, 100)
    window.localStorage.setItem(COACH_OVERRIDE_LOG_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function parseOverrideLog(raw: string | null): OverrideLogEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: OverrideLogEntry[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      if (typeof o.at !== 'string' || typeof o.mint !== 'string') continue
      if (o.side !== 'buy' && o.side !== 'sell') continue
      if (o.action !== 'overridden' && o.action !== 'muted' && o.action !== 'dismissed') continue
      if (!Array.isArray(o.triggers)) continue
      out.push({
        at: o.at,
        mint: o.mint,
        side: o.side,
        triggers: o.triggers.filter((t): t is InterruptTriggerId => typeof t === 'string') as InterruptTriggerId[],
        action: o.action,
        verdict: typeof o.verdict === 'string' ? (o.verdict as TerminalVerdict) : null,
      })
    }
    return out
  } catch {
    return []
  }
}

export function loadOverrideLog(): OverrideLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return parseOverrideLog(window.localStorage.getItem(COACH_OVERRIDE_LOG_KEY))
  } catch {
    return []
  }
}

export type OverrideLogSummary = {
  total: number
  overridden: number
  muted: number
  dismissed: number
  /** Entries with at ≥ sinceIso */
  sinceCount: number
  sinceOverridden: number
}

export function summarizeOverrideLog(
  entries: OverrideLogEntry[],
  sinceIso?: string,
): OverrideLogSummary {
  const since = sinceIso ? Date.parse(sinceIso) : NaN
  let overridden = 0
  let muted = 0
  let dismissed = 0
  let sinceCount = 0
  let sinceOverridden = 0
  for (const e of entries) {
    if (e.action === 'overridden') overridden++
    else if (e.action === 'muted') muted++
    else if (e.action === 'dismissed') dismissed++
    if (Number.isFinite(since) && Date.parse(e.at) >= since) {
      sinceCount++
      if (e.action === 'overridden') sinceOverridden++
    }
  }
  return {
    total: entries.length,
    overridden,
    muted,
    dismissed,
    sinceCount: Number.isFinite(since) ? sinceCount : entries.length,
    sinceOverridden: Number.isFinite(since) ? sinceOverridden : overridden,
  }
}

export function hasHardBlock(interrupts: CoachInterrupt[]): boolean {
  return interrupts.some((i) => i.severity === 'hard' || i.blocksSubmit)
}

export function hasSoftGate(interrupts: CoachInterrupt[]): boolean {
  return interrupts.some((i) => i.severity === 'soft' && !i.blocksSubmit)
}
