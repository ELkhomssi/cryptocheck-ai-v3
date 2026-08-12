/**
 * AI Gateway Round 2 — presentation / information-architecture helpers.
 * No Decision Engine, Layer 1, or execution-logic changes.
 * Numbers and statuses must come from real Decision / tickMeta / DNA / history.
 */

import type { Decision, DecisionAction, EngineId } from '@cryptocheck/decision-contracts'
import type { DecisionTickMeta } from './gateway-phase'

function timeOfDayGreeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Client-safe mirror of DecisionHistoryPoint (server store stays server-only). */
export type GatewayHistoryPoint = {
  at: string
  action: Decision['action']
  confidence: number
  marketConfidence: number
}

/** Actionability weight for hero pick — prefers tradeable actions, then confidence. */
const ACTION_RANK: Record<DecisionAction, number> = {
  BUY: 4,
  SELL: 4,
  EXIT: 3,
  WAIT: 1,
  DO_NOTHING: 0,
}

export function looksLikeAddressLabel(s: string): boolean {
  const t = s.trim()
  if (/^0x[a-fA-F0-9]{6,}$/i.test(t)) return true
  if (/^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(t)) return true
  // Truncated wallet labels: AbCd…wXyZ or AbCd...wXyZ (ellipsis / 3+ dots — not ENS `.sol`)
  if (/^[A-Za-z0-9]{3,6}(…|\.{3,})[A-Za-z0-9]{3,6}$/.test(t)) return true
  return false
}

/**
 * Session display name — profile / ENS-like only.
 * Never treat a truncated wallet address as a personal name.
 */
export function resolveGatewayDisplayName(opts: {
  profileName?: string | null
  ensName?: string | null
  walletLabel?: string | null
}): string | null {
  for (const candidate of [opts.profileName, opts.ensName, opts.walletLabel]) {
    const t = candidate?.trim()
    if (!t) continue
    if (looksLikeAddressLabel(t)) continue
    if (/\.(eth|sol)$/i.test(t) || t.length >= 2) return t
  }
  return null
}

export type GatewayGreeting = {
  lines: string[]
  /** True when tickMeta had real scanned > 0 */
  hasCycleData: boolean
}

export function buildGatewayGreeting(opts: {
  displayName: string | null
  tickMeta: DecisionTickMeta | null
  /** Real: holdings fetch completed for connected wallet */
  portfolioReviewed: boolean
  now?: Date
}): GatewayGreeting {
  const hi = timeOfDayGreeting(opts.now ?? new Date())
  const head = opts.displayName ? `${hi}, ${opts.displayName}.` : `${hi} —`
  const meta = opts.tickMeta

  if (!meta || !(meta.scanned > 0)) {
    return {
      lines: [
        head,
        'Command desk online — Decision Engine tick pending. Engine mesh stays on standby until a Decision publishes (real weights only — no mock scores).',
      ],
      hasCycleData: false,
    }
  }

  const lines = [
    head,
    `Markets monitored: ${meta.scanned}.`,
  ]
  if (opts.portfolioReviewed) {
    lines.push('Portfolio analyzed.')
  }
  const opps = meta.buyCount
  if (opps === 1) {
    lines.push('1 opportunity requires your attention.')
  } else {
    lines.push(`${opps} opportunities require your attention.`)
  }
  return { lines, hasCycleData: true }
}

/**
 * Pick a single hero Decision — highest confidence among most-actionable.
 * Presentation ranking only (reuses Decision.confidence + action); no new engine.
 */
export function selectHeroDecision(decisions: Decision[]): Decision | null {
  if (!decisions.length) return null
  return [...decisions].sort((a, b) => {
    const byAction = ACTION_RANK[b.action] - ACTION_RANK[a.action]
    if (byAction !== 0) return byAction
    return b.confidence - a.confidence
  })[0]!
}

/** 1–2 line reason for hero — not the full contributingFactors dump. */
export function heroReason(reasoning: string | null | undefined, maxChars = 160): string {
  // Published Decisions may omit reasoning under degradation; never call .replace on null.
  const cleaned = String(reasoning ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  let out = sentences.slice(0, 2).join(' ')
  if (!out) out = cleaned
  if (out.length > maxChars) {
    const cut = out.slice(0, maxChars - 1)
    const sp = cut.lastIndexOf(' ')
    out = `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
  }
  return out
}

export function decisionAgeLabel(computedAt: string, now = Date.now()): string {
  const t = new Date(computedAt).getTime()
  if (!Number.isFinite(t)) return 'Age unknown'
  const sec = Math.max(0, Math.floor((now - t) / 1000))
  if (sec < 60) return `Age ${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `Age ${min}m`
  const h = Math.floor(min / 60)
  return `Age ${h}h`
}

export function decisionFreshnessLabel(staleAfter: string, now = Date.now()): string {
  const t = new Date(staleAfter).getTime()
  if (!Number.isFinite(t)) return 'Freshness unknown'
  const sec = Math.floor((t - now) / 1000)
  if (sec <= 0) return 'Stale — refresh pending'
  if (sec < 60) return `Fresh ${sec}s`
  const min = Math.floor(sec / 60)
  return `Fresh ${min}m`
}

export type EngineCheckStatus = 'live' | 'unavailable' | 'loading' | 'standby'

export type EngineCheckRow = {
  id: EngineId
  label: string
  status: EngineCheckStatus
}

const ENGINE_ROWS: { id: EngineId; label: string }[] = [
  { id: 'security-scanner', label: 'Security' },
  { id: 'market-intelligence', label: 'Momentum' },
  { id: 'whale-intelligence', label: 'Whales' },
  { id: 'trader-dna', label: 'DNA' },
  { id: 'portfolio-intelligence', label: 'Portfolio' },
]

/**
 * Per-engine checklist from real Decision fields only.
 * live = contributed (factor present) or completed without being marked degraded
 * unavailable = listed in degradedInputs
 * loading = Decision still fetching
 * standby = no Decision yet — engines armed, not scored (honest empty, dense chrome)
 */
export function engineChecklist(opts: {
  decisionLoading: boolean
  decision: Decision | null
}): EngineCheckRow[] {
  if (opts.decisionLoading && !opts.decision) {
    return ENGINE_ROWS.map((r) => ({ ...r, status: 'loading' as const }))
  }
  const d = opts.decision
  if (!d) {
    return ENGINE_ROWS.map((r) => ({ ...r, status: 'standby' as const }))
  }
  const degraded = new Set(d.degradedInputs ?? [])
  const contributed = new Set(
    (d.contributingFactors ?? []).map((f) => String(f.engine) as EngineId | string),
  )

  return ENGINE_ROWS.map((r) => {
    if (degraded.has(r.id)) return { ...r, status: 'unavailable' as const }
    if (contributed.has(r.id)) return { ...r, status: 'live' as const }
    // Tick always builds market intel + security scores into the Decision when published
    if (r.id === 'market-intelligence' || r.id === 'security-scanner') {
      return { ...r, status: 'live' as const }
    }
    // Not cited and not explicitly degraded → unavailable (honest, not ✓)
    return { ...r, status: 'unavailable' as const }
  })
}

export function engineStatusMark(status: EngineCheckStatus): string {
  if (status === 'live') return '✓'
  if (status === 'loading') return '…'
  if (status === 'standby') return '○'
  return '—'
}

export function riskBand(risk: number): 'Low' | 'Medium' | 'High' {
  if (risk < 34) return 'Low'
  if (risk < 67) return 'Medium'
  return 'High'
}

export type MissionSummary = {
  actionLine: string
  reason: string
  risk: string
  expectedRoi: string | null
  /** Present only when derived from real TraderDNA.avgHoldingMs */
  holding: string | null
}

/** Honest metric cell — never invent numbers; use Unavailable when field absent. */
export type HeroMetricCell = {
  label: string
  value: string
  /** True when value is a real derived field (not Unavailable) */
  available: boolean
  hint?: string
}

export type HeroMetrics = {
  /** CONFIDENCE / EXPECTED ROI / RISK LEVEL / POSITION SIZE */
  primary: HeroMetricCell[]
  /** TIME HORIZON / STRATEGY / CAPITAL ALLOCATION */
  secondary: HeroMetricCell[]
}

export const UNAVAILABLE = 'Unavailable' as const

/** Dense waiting metric chrome — labels only; every value Unavailable until Decision. */
export function standbyHeroMetrics(): HeroMetrics {
  return {
    primary: [
      { label: 'Confidence', value: UNAVAILABLE, available: false, hint: 'Awaiting Decision' },
      { label: 'Expected ROI', value: UNAVAILABLE, available: false },
      { label: 'Risk Level', value: UNAVAILABLE, available: false },
      { label: 'Position Size', value: UNAVAILABLE, available: false },
    ],
    secondary: [
      { label: 'Time Horizon', value: UNAVAILABLE, available: false },
      { label: 'Strategy', value: UNAVAILABLE, available: false },
      { label: 'Capital Allocation', value: UNAVAILABLE, available: false },
    ],
  }
}

/** Conviction badge gated on real Decision.confidence — never unconditional. */
export function convictionBadgeLabel(confidence: number): string | null {
  if (!Number.isFinite(confidence)) return null
  if (confidence >= 85) return 'ULTRA HIGH CONVICTION'
  if (confidence >= 72) return 'HIGH CONVICTION'
  return null
}

export function formatHoldingFromDna(avgHoldingMs: number | null | undefined): string | null {
  if (avgHoldingMs == null || !Number.isFinite(avgHoldingMs) || avgHoldingMs <= 0) return null
  const h = avgHoldingMs / 3_600_000
  if (h < 1) {
    const m = Math.max(1, Math.round(h * 60))
    return `~${m}m`
  }
  const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10
  return `~${rounded}h`
}

/**
 * Strategy label from real TraderDNA only (sampleSize ≥ 3 + non-empty summary).
 * Never invent a strategy string for untrained wallets.
 */
export function strategyFromDna(opts: {
  sampleSize?: number | null
  tradingStyleSummary?: string | null
}): string | null {
  if ((opts.sampleSize ?? 0) < 3) return null
  const s = opts.tradingStyleSummary?.trim()
  if (!s || s.length === 0) return null
  if (/insufficient/i.test(s)) return null
  return s
}

export function buildMissionSummary(
  decision: Decision,
  opts?: { avgHoldingMs?: number | null },
): MissionSummary {
  const symbol =
    decision.subject?.kind === 'token' ? decision.subject.symbol : undefined
  const actionLine = symbol ? `${decision.action} ${symbol}` : decision.action
  const roi =
    decision.expectedROI != null && Number.isFinite(decision.expectedROI)
      ? `${decision.expectedROI > 0 ? '+' : ''}${decision.expectedROI.toFixed(1)}%`
      : null
  const riskNum = typeof decision.risk === 'number' && Number.isFinite(decision.risk) ? decision.risk : 50
  return {
    actionLine,
    reason: heroReason(decision.reasoning, 120),
    risk: riskBand(riskNum),
    expectedRoi: roi,
    holding: formatHoldingFromDna(opts?.avgHoldingMs),
  }
}

/**
 * Hero metric rows for mockup layout — all values from Decision + optional DNA.
 * positionSize / capitalAllocation are not on Decision → Unavailable (honest).
 */
export function buildHeroMetrics(
  decision: Decision,
  opts?: {
    avgHoldingMs?: number | null
    dnaSampleSize?: number | null
    tradingStyleSummary?: string | null
  },
): HeroMetrics {
  const roi =
    decision.expectedROI != null && Number.isFinite(decision.expectedROI)
      ? `${decision.expectedROI > 0 ? '+' : ''}${decision.expectedROI.toFixed(1)}%`
      : null
  const holding = formatHoldingFromDna(opts?.avgHoldingMs)
  const strategy = strategyFromDna({
    sampleSize: opts?.dnaSampleSize,
    tradingStyleSummary: opts?.tradingStyleSummary,
  })
  const confidence =
    typeof decision.confidence === 'number' && Number.isFinite(decision.confidence)
      ? decision.confidence
      : 0
  const riskNum =
    typeof decision.risk === 'number' && Number.isFinite(decision.risk) ? decision.risk : 50
  const risk = riskBand(riskNum)

  return {
    primary: [
      {
        label: 'Confidence',
        value: `${Math.round(confidence)}%`,
        available: typeof decision.confidence === 'number' && Number.isFinite(decision.confidence),
        hint:
          decision.confidenceMode === 'personalized' ? 'Personalized' : 'Market',
      },
      {
        label: 'Expected ROI',
        value: roi ?? UNAVAILABLE,
        available: roi != null,
      },
      {
        label: 'Risk Level',
        value: `${risk} (${Math.round(riskNum)})`,
        available: typeof decision.risk === 'number' && Number.isFinite(decision.risk),
      },
      {
        label: 'Position Size',
        value: UNAVAILABLE,
        available: false,
        hint: 'Not published on Decision',
      },
    ],
    secondary: [
      {
        label: 'Time Horizon',
        value: holding ?? UNAVAILABLE,
        available: holding != null,
        hint: holding ? 'From Trader DNA hold time' : 'Train DNA with real fills',
      },
      {
        label: 'Strategy',
        value: strategy ?? UNAVAILABLE,
        available: strategy != null,
        hint: strategy ? 'From Trader DNA' : 'Untrained wallet',
      },
      {
        label: 'Capital Allocation',
        value: UNAVAILABLE,
        available: false,
        hint: 'Not published on Decision',
      },
    ],
  }
}

/** Sparkline needs ≥2 distinct history points with confidence. */
export function confidenceSeries(history: GatewayHistoryPoint[] | null | undefined): number[] {
  if (!history?.length) return []
  return history.map((p) => p.confidence).filter((n) => Number.isFinite(n))
}

export function canShowConfidenceTrend(series: number[]): boolean {
  return series.length >= 2
}
