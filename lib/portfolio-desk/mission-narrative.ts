/**
 * Phase 17.1 — Mission Control narrative formatters.
 * Pure presentation over already-fetched MissionViewModel / timeline / modules.
 * Never invents market moves, risks, or opportunities — explains gaps honestly.
 */

import type { ModuleCardView } from '@/types/intelligence'
import type { MissionViewModel, TimelineEvent } from '@/types/intelligence-core'

export function timeOfDayGreeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function estimateReadingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(8, Math.min(45, Math.round(words / 3.2)))
}

/** Map raw agent activity copy → Alive-Never-Fake progress phrases. */
export function runningIntelligenceLabel(description: string, kind: string): string {
  const d = (description || '').toLowerCase()
  if (d.includes('liquidity')) return 'Analyzing liquidity…'
  if (d.includes('launch') || d.includes('listing')) return 'Scanning new launches…'
  if (d.includes('whale') || d.includes('wallet')) return 'Watching wallet activity…'
  if (d.includes('report') || d.includes('brief') || kind === 'report') return 'Building today’s opportunities…'
  if (d.includes('risk') || d.includes('audit') || d.includes('scam')) return 'Checking contract safety…'
  if (d.includes('scan') || d.includes('running your query')) return 'Scanning…'
  if (description.trim()) return description.trim()
  return 'Working…'
}

export type ExecutiveBrief = {
  greetingLine: string
  paragraphs: string[]
  readingSeconds: number
  dataGaps: string[]
}

export function buildExecutiveBrief(params: {
  displayName: string | null
  view: MissionViewModel | null
  loading: boolean
}): ExecutiveBrief {
  if (params.loading || !params.view) {
    return {
      greetingLine: `${timeOfDayGreeting()}.`,
      paragraphs: ['Assembling your mission brief from live market and portfolio feeds…'],
      readingSeconds: 10,
      dataGaps: [],
    }
  }

  const v = params.view
  const name = params.displayName?.trim()
  const greetingLine = name
    ? `${timeOfDayGreeting()} ${name}.`
    : `${timeOfDayGreeting()}. Connect a wallet for a personalized portfolio briefing.`

  const paragraphs: string[] = []
  const dataGaps: string[] = []

  if (v.market.available && v.market.aggregateChange24hPct != null) {
    const chg = v.market.aggregateChange24hPct
    const tone =
      chg > 1.5 ? 'increasingly aggressive' : chg < -1.5 ? 'risk-off' : 'relatively balanced'
    paragraphs.push(
      `The Solana market glance is ${tone} today — aggregate 24h change across the live screener sample is ${fmtSignedPct(chg)}.`,
    )
    if (v.market.topMoverSymbol) {
      paragraphs.push(
        `Largest absolute move in the sample: ${v.market.topMoverSymbol} at ${fmtSignedPct(v.market.topMoverChange24hPct ?? 0)}.`,
      )
    }
  } else {
    dataGaps.push('Market glance unavailable — providers returned no screener rows.')
    paragraphs.push(
      'Market overview is unavailable right now because the screener feed returned no rows.',
    )
  }

  if (!v.portfolio.connected) {
    paragraphs.push('Portfolio exposure is unknown until a wallet is connected.')
  } else if (v.portfolio.error) {
    dataGaps.push('Portfolio fetch failed.')
    paragraphs.push(
      'Portfolio health could not be loaded — the holdings request failed. Retry from Portfolio Intelligence.',
    )
  } else {
    const day = v.portfolio.dayChangePct
    const vol =
      day == null
        ? 'unknown (24h change not available for holdings)'
        : Math.abs(day) >= 5
          ? 'elevated'
          : Math.abs(day) >= 2
            ? 'medium'
            : 'contained'
    paragraphs.push(
      `Your portfolio currently shows ${vol} exposure to short-term volatility${
        day != null ? ` (${fmtSignedPct(day)} over 24h)` : ''
      }.`,
    )
    if (v.portfolio.topWeightSymbol) {
      paragraphs.push(
        `Largest weight sits in ${v.portfolio.topWeightSymbol} — concentration is the first thing to watch.`,
      )
    }
  }

  const critical = v.recommendations.filter((r) => !r.grounded).length
  if (v.running.length === 0) {
    paragraphs.push('No critical automated jobs are executing right now.')
  } else {
    paragraphs.push(
      `${v.running.length} intelligence job${v.running.length === 1 ? ' is' : 's are'} running.`,
    )
  }

  const grounded = v.recommendations.filter((r) => r.grounded)
  if (grounded.length > 0) {
    paragraphs.push(
      `${Math.min(2, grounded.length)} opportunit${grounded.length === 1 ? 'y deserves' : 'ies deserve'} attention — listed under Mission Priorities.`,
    )
  } else if (v.dailyBrief.insufficientActivity) {
    paragraphs.push('Not enough timeline activity yet for a dense daily brief.')
  } else if (v.dailyBrief.body && !v.dailyBrief.pending) {
    paragraphs.push('A morning brief is available when you need the longer read.')
  }

  if (critical > 0 && grounded.length === 0) {
    // grounded=false means honest "cause not available" — not a fabricated opportunity
  }

  const text = paragraphs.join(' ')
  return {
    greetingLine,
    paragraphs,
    readingSeconds: estimateReadingSeconds(text),
    dataGaps,
  }
}

export type MarketNarrative = {
  title: string
  paragraphs: string[]
  sourcesNote: string
  unavailableReason: string | null
}

export function buildMarketNarrative(view: MissionViewModel | null): MarketNarrative {
  if (!view || !view.market.available) {
    return {
      title: "Today's market summary",
      paragraphs: [],
      sourcesNote: 'Birdeye · Jupiter · Helius · Raydium (via existing screener corpus)',
      unavailableReason:
        'Market narrative paused — the live screener sample is empty or providers did not return rows.',
    }
  }
  const m = view.market
  const paragraphs: string[] = []
  const chg = m.aggregateChange24hPct
  if (chg != null) {
    if (chg > 2) {
      paragraphs.push(
        'The live sample is favoring risk-on names — aggregate 24h change is materially positive.',
      )
    } else if (chg < -2) {
      paragraphs.push(
        'The live sample is defensive — aggregate 24h change is materially negative.',
      )
    } else {
      paragraphs.push(
        'The live sample is mixed — aggregate 24h change is near flat, so direction is not decisive from this glance alone.',
      )
    }
  }
  if (m.topMoverSymbol) {
    paragraphs.push(
      `${m.topMoverSymbol} leads absolute movement in the current sample at ${fmtSignedPct(m.topMoverChange24hPct ?? 0)}.`,
    )
  }
  if (m.spark.length >= 4) {
    const up = m.spark.filter((x) => x > 0).length
    paragraphs.push(
      `Among the first ${m.spark.length} names in the glance, ${up} print green on 24h — a simple breadth read, not a forecast.`,
    )
  }
  if (!paragraphs.length) {
    return {
      title: "Today's market summary",
      paragraphs: [],
      sourcesNote: 'Birdeye · Jupiter · Helius · Raydium (via existing screener corpus)',
      unavailableReason: 'Screener rows loaded but lacked usable change fields for a narrative.',
    }
  }
  return {
    title: "Today's market summary",
    paragraphs,
    sourcesNote: 'Birdeye · Jupiter · Helius · Raydium (via existing screener corpus)',
    unavailableReason: null,
  }
}

export type PortfolioNarrative = {
  title: string
  healthLine: string
  riskLabel: 'Low' | 'Medium' | 'Elevated' | 'Unknown'
  weakness: string | null
  suggestedAction: string | null
  confidenceLabel: string | null
  numbers: { totalValueUsd: number | null; dayChangePct: number | null; topWeightSymbol: string | null }
  unavailableReason: string | null
}

export function buildPortfolioNarrative(
  view: MissionViewModel | null,
): PortfolioNarrative {
  const emptyNums = { totalValueUsd: null, dayChangePct: null, topWeightSymbol: null }
  if (!view) {
    return {
      title: 'Portfolio Health',
      healthLine: 'Waiting for portfolio context…',
      riskLabel: 'Unknown',
      weakness: null,
      suggestedAction: null,
      confidenceLabel: null,
      numbers: emptyNums,
      unavailableReason: null,
    }
  }
  if (!view.portfolio.connected) {
    return {
      title: 'Portfolio Health',
      healthLine: 'Connect a wallet to interpret portfolio risk.',
      riskLabel: 'Unknown',
      weakness: null,
      suggestedAction: 'Connect your Solana wallet.',
      confidenceLabel: null,
      numbers: emptyNums,
      unavailableReason: 'No wallet connected — portfolio narrative cannot be computed.',
    }
  }
  if (view.portfolio.error) {
    return {
      title: 'Portfolio Health',
      healthLine: 'Portfolio data failed to load.',
      riskLabel: 'Unknown',
      weakness: null,
      suggestedAction: 'Retry from Portfolio Intelligence.',
      confidenceLabel: null,
      numbers: emptyNums,
      unavailableReason: view.portfolio.error,
    }
  }

  const day = view.portfolio.dayChangePct
  let riskLabel: PortfolioNarrative['riskLabel'] = 'Unknown'
  if (day != null) {
    riskLabel = Math.abs(day) >= 5 ? 'Elevated' : Math.abs(day) >= 2 ? 'Medium' : 'Low'
  }

  const healthLine =
    riskLabel === 'Low'
      ? 'Your portfolio looks stable on the latest 24h read.'
      : riskLabel === 'Medium'
        ? 'Your portfolio is healthy enough to operate — volatility is present, not extreme.'
        : riskLabel === 'Elevated'
          ? 'Your portfolio is under pressure on the latest 24h read.'
          : 'Portfolio value is available, but 24h change is missing for a risk label.'

  const weakness = view.portfolio.topWeightSymbol
    ? `Largest weight is concentrated in ${view.portfolio.topWeightSymbol}.`
    : null

  const suggestedAction = view.portfolio.topWeightSymbol
    ? 'Review concentration in Portfolio Intelligence before sizing new risk.'
    : 'Open Portfolio Intelligence to complete cost-basis and allocation detail.'

  // Confidence is coverage of available fields — not a fabricated model score.
  let covered = 0
  let total = 3
  if (view.portfolio.totalValueUsd != null) covered++
  if (view.portfolio.dayChangePct != null) covered++
  if (view.portfolio.topWeightSymbol) covered++
  const confidenceLabel = `${Math.round((covered / total) * 100)}% data coverage`

  return {
    title: 'Portfolio Health',
    healthLine,
    riskLabel,
    weakness,
    suggestedAction,
    confidenceLabel,
    numbers: {
      totalValueUsd: view.portfolio.totalValueUsd,
      dayChangePct: view.portfolio.dayChangePct,
      topWeightSymbol: view.portfolio.topWeightSymbol,
    },
    unavailableReason: null,
  }
}

export type MissionPriority = {
  id: string
  level: 'High' | 'Medium' | 'Low'
  title: string
  detail: string
}

/** Max 3, ordered by importance — real recommendations / brief / running only. */
export function buildMissionPriorities(view: MissionViewModel | null): MissionPriority[] {
  if (!view) return []
  const out: MissionPriority[] = []

  for (const r of view.recommendations.filter((x) => x.grounded).slice(0, 2)) {
    out.push({
      id: r.predictionId || `rec-${out.length}`,
      level: out.length === 0 ? 'High' : 'Medium',
      title: r.title,
      detail: r.explanation,
    })
  }

  if (view.running[0]) {
    out.push({
      id: `run-${view.running[0].id}`,
      level: out.length === 0 ? 'High' : 'Medium',
      title: runningIntelligenceLabel(view.running[0].description, view.running[0].kind),
      detail: 'Live job from agent activity — not a simulated status.',
    })
  }

  if (out.length < 3 && view.dailyBrief.body && !view.dailyBrief.pending) {
    out.push({
      id: view.dailyBrief.reportId || 'brief',
      level: 'Low',
      title: view.dailyBrief.insufficientActivity
        ? 'Daily brief waiting on activity'
        : `${view.dailyBrief.title} ready`,
      detail: view.dailyBrief.insufficientActivity
        ? view.dailyBrief.body
        : 'Open the brief section for the stored report body.',
    })
  }

  return out.slice(0, 3)
}

export type Observation = { id: string; text: string }

export function buildObservations(params: {
  view: MissionViewModel | null
  modules: ModuleCardView[]
}): Observation[] {
  const out: Observation[] = []
  const v = params.view
  if (!v) {
    return [{ id: 'wait', text: 'Observations appear when the mission view finishes loading.' }]
  }

  if (v.market.available && (v.market.aggregateChange24hPct ?? 0) > 1) {
    out.push({ id: 'm1', text: 'Market glance leaning constructive on the current screener sample.' })
  } else if (v.market.available && (v.market.aggregateChange24hPct ?? 0) < -1) {
    out.push({ id: 'm2', text: 'Market glance leaning defensive on the current screener sample.' })
  } else if (!v.market.available) {
    out.push({ id: 'm3', text: 'Market glance unavailable — no fabricated confidence signal.' })
  }

  const dangerModules = params.modules.filter(
    (m) => m.state === 'running' || m.state === 'investigating',
  )
  if (dangerModules.length) {
    out.push({
      id: 'mod-run',
      text: `${dangerModules.map((m) => m.displayName).join(', ')} actively working.`,
    })
  }

  const calibrating = params.modules.filter((m) => m.calibrating).length
  if (calibrating > 0) {
    out.push({
      id: 'cal',
      text: `${calibrating} intelligence module${calibrating === 1 ? '' : 's'} still calibrating — scores withheld until thresholds are met.`,
    })
  }

  if (v.portfolio.connected && !v.portfolio.error && v.portfolio.topWeightSymbol) {
    out.push({
      id: 'conc',
      text: `Concentration watch: ${v.portfolio.topWeightSymbol} is the largest weight.`,
    })
  }

  if (v.running.length === 0) {
    out.push({ id: 'idle', text: 'No critical automated jobs running.' })
  }

  return out.slice(0, 6)
}

export function formatTimelineClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '--:--'
  }
}

export function timelineHeadline(ev: TimelineEvent): string {
  return ev.summary || ev.eventType
}

function fmtSignedPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}
