/**
 * Mission Control conversation assembly — presentation only.
 * Assembles speech from MissionViewModel. Never invents activity.
 *
 * Hierarchy: conversation → action → evidence → metrics → timeline.
 * Numbers never lead. Judgement does.
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

/** Pull a real count from engine copy when present — never invent one. */
function countFromDescription(description: string): string | null {
  const m = description.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/)
  return m?.[1] ?? null
}

/** Map raw agent activity copy → living intelligence. No job IDs / queues. */
export function runningIntelligenceLabel(description: string, kind: string): string {
  const d = (description || '').toLowerCase()
  const n = countFromDescription(description)

  if (d.includes('whale')) {
    return n ? `Watching ${n} whales…` : 'Watching whale activity…'
  }
  if (d.includes('wallet') || d.includes('holder')) {
    return n ? `Monitoring ${n} wallets…` : 'Watching wallet activity…'
  }
  if (d.includes('launch') || d.includes('listing')) {
    return n ? `Scanning ${n} new launches…` : 'Scanning new launches…'
  }
  if (d.includes('liquidity') || d.includes('pool')) {
    return 'Checking liquidity anomalies…'
  }
  if (d.includes('dev') || d.includes('developer')) {
    return 'Checking developer wallets…'
  }
  if (d.includes('report') || d.includes('brief') || kind === 'report') {
    return 'Building today’s report…'
  }
  if (d.includes('learn') || d.includes('memory') || d.includes('behaviour') || d.includes('behavior')) {
    return 'Learning market behaviour…'
  }
  if (d.includes('risk') || d.includes('audit') || d.includes('scam') || d.includes('portfolio')) {
    return 'Watching your portfolio…'
  }
  if (d.includes('scan') || d.includes('running your query')) {
    return 'Scanning…'
  }
  if (description.trim() && !/job\s*#|queue|task\s*id|process\s*#/i.test(description)) {
    return description.trim().replace(/\.*$/, '') + '…'
  }
  return 'Working in the background…'
}

export type SpeechTurn = {
  id: string
  /** Conversation blocks — no cards, no metric grids. */
  kind: 'speech' | 'live' | 'ask'
  text: string
}

export type MissionMetric = { label: string; value: string }

export type MissionConversation = {
  turns: SpeechTurn[]
  suggestions: string[]
  /** Supporting evidence — below the conversation. */
  evidence: string[]
  /** Raw numbers — after evidence. */
  metrics: MissionMetric[]
  readingSeconds: number
}

/**
 * One continuous briefing the OS speaks on open.
 * Conclusions first. Honest gaps. Ends by asking what to do.
 */
export function buildMissionConversation(params: {
  displayName: string | null
  view: MissionViewModel | null
  loading: boolean
}): MissionConversation {
  if (params.loading || !params.view) {
    return {
      turns: [
        {
          id: 'load',
          kind: 'speech',
          text: `${timeOfDayGreeting()}. I’m assembling your briefing from live feeds…`,
        },
      ],
      suggestions: ["Explain today's market", 'Review my portfolio'],
      evidence: [],
      metrics: [],
      readingSeconds: 8,
    }
  }

  const v = params.view
  const turns: SpeechTurn[] = []
  const evidence: string[] = []
  const metrics: MissionMetric[] = []
  const name = params.displayName?.trim()

  turns.push({
    id: 'greet',
    kind: 'speech',
    text: name ? `${timeOfDayGreeting()} ${name}.` : `${timeOfDayGreeting()}.`,
  })

  // —— Market: judgement only ——
  if (!v.market.available || v.market.aggregateChange24hPct == null) {
    turns.push({
      id: 'mkt-gap',
      kind: 'speech',
      text: 'I don’t have enough information yet on market direction.',
    })
  } else {
    const chg = v.market.aggregateChange24hPct
    if (chg > 2) {
      turns.push({
        id: 'mkt',
        kind: 'speech',
        text: 'Today’s market became more aggressive. Buying pressure is elevated across the live sample.',
      })
    } else if (chg < -2) {
      turns.push({
        id: 'mkt',
        kind: 'speech',
        text: 'Today’s market turned defensive. Selling pressure is visible across the live sample.',
      })
    } else {
      turns.push({
        id: 'mkt',
        kind: 'speech',
        text: 'The market is relatively balanced — no decisive aggression or retreat in the live sample.',
      })
    }

    evidence.push(`Sample aggregate 24h move: ${fmtSignedPct(chg)}.`)
    metrics.push({ label: 'Sample 24h', value: fmtSignedPct(chg) })
    if (v.market.topMoverSymbol) {
      evidence.push(
        `${v.market.topMoverSymbol} leads absolute movement at ${fmtSignedPct(v.market.topMoverChange24hPct ?? 0)}.`,
      )
      metrics.push({
        label: 'Top mover',
        value: `${v.market.topMoverSymbol} ${fmtSignedPct(v.market.topMoverChange24hPct ?? 0)}`,
      })
    }
    if (v.market.spark.length >= 4) {
      const up = v.market.spark.filter((x) => x > 0).length
      evidence.push(`${up} of the first ${v.market.spark.length} names print green on 24h.`)
    }
  }

  // —— Portfolio: judgement, not balances ——
  if (!v.portfolio.connected) {
    turns.push({
      id: 'pf',
      kind: 'speech',
      text: 'I can’t judge your portfolio until a wallet is connected.',
    })
  } else if (v.portfolio.error) {
    turns.push({
      id: 'pf',
      kind: 'speech',
      text: 'I don’t have enough information yet on your portfolio — the holdings request failed.',
    })
  } else {
    const day = v.portfolio.dayChangePct
    const pressure =
      day == null ? null : Math.abs(day) < 2 ? 'healthy' : Math.abs(day) < 5 ? 'watchful' : 'stressed'

    if (pressure === 'healthy') {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'I’ve been monitoring your portfolio. Nothing critical threatens it on the latest 24h read.',
      })
    } else if (pressure === 'watchful') {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'I’ve been monitoring your portfolio. It is operable, but volatility deserves attention.',
      })
    } else if (pressure === 'stressed') {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'I’ve been monitoring your portfolio. It is under pressure on the latest 24h read.',
      })
    } else {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'I don’t have enough information yet to call portfolio risk confidently.',
      })
    }

    if (v.portfolio.topWeightSymbol) {
      turns.push({
        id: 'pf-risk',
        kind: 'speech',
        text: `Your largest weakness is concentration in ${v.portfolio.topWeightSymbol}. That is the first risk to monitor before you size anything new.`,
      })
    }

    if (v.portfolio.totalValueUsd != null) {
      metrics.push({
        label: 'Portfolio value',
        value: `$${v.portfolio.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      })
      evidence.push(
        `Balances (supporting): ~$${v.portfolio.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}${
          day != null ? ` · 24h ${fmtSignedPct(day)}` : ''
        }.`,
      )
    }
    if (day != null) {
      metrics.push({ label: 'Portfolio 24h', value: fmtSignedPct(day) })
    }
    if (v.portfolio.topWeightSymbol) {
      metrics.push({ label: 'Largest position', value: v.portfolio.topWeightSymbol })
    }
  }

  // —— Opportunities from grounded recommendations only ——
  const grounded = v.recommendations.filter((r) => r.grounded)
  if (grounded.length > 0) {
    turns.push({
      id: 'opp',
      kind: 'speech',
      text:
        grounded.length === 1
          ? `One opportunity deserves investigation: ${grounded[0]!.title}.`
          : `${Math.min(2, grounded.length)} unusual items deserve your attention. First: ${grounded[0]!.title}.`,
    })
    evidence.push(grounded[0]!.explanation)
    if (grounded[1]) {
      turns.push({
        id: 'opp-2',
        kind: 'speech',
        text: `Second: ${grounded[1].title}.`,
      })
      evidence.push(grounded[1].explanation)
    }
  } else if (v.dailyBrief.insufficientActivity) {
    turns.push({
      id: 'opp-gap',
      kind: 'speech',
      text: 'I don’t have enough information yet for denser opportunities.',
    })
  }

  // —— Living activity (never job machinery) ——
  if (v.running.length > 0) {
    turns.push({
      id: 'live',
      kind: 'live',
      text: v.running
        .slice(0, 4)
        .map((r) => runningIntelligenceLabel(r.description, r.kind))
        .join('\n'),
    })
  }

  turns.push({
    id: 'ask',
    kind: 'ask',
    text: 'What would you like me to do?',
  })

  const full = turns.map((t) => t.text).join(' ')
  return {
    turns,
    suggestions: buildDynamicSuggestions(v),
    evidence,
    metrics,
    readingSeconds: estimateReadingSeconds(full),
  }
}

/** Suggestions change with live state — never a fixed casino button row. */
export function buildDynamicSuggestions(view: MissionViewModel): string[] {
  const out: string[] = []

  if (!view.portfolio.connected) {
    out.push('Review my portfolio')
  } else if (view.portfolio.topWeightSymbol) {
    out.push(`Explain risk in ${view.portfolio.topWeightSymbol}`)
    out.push('What should I monitor today?')
  } else {
    out.push('Review my portfolio')
  }

  if (view.market.available) {
    out.push("Explain today's market")
    if (view.market.topMoverSymbol) {
      out.push(`Why is ${view.market.topMoverSymbol} moving?`)
    }
  } else {
    out.push('Find opportunities')
  }

  const grounded = view.recommendations.find((r) => r.grounded)
  if (grounded) {
    out.push(`Tell me more about ${grounded.title}`)
  } else {
    out.push('Scan this token')
  }

  if (view.running.length > 0) {
    out.push('What are you watching?')
  } else {
    out.push('Track this wallet')
  }

  const seen = new Set<string>()
  const unique: string[] = []
  for (const s of out) {
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(s)
    if (unique.length >= 4) break
  }
  return unique
}

// —— Legacy helpers kept for tests / aside (still presentation-only) ——

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
  const conv = buildMissionConversation(params)
  const speech = conv.turns.filter((t) => t.kind === 'speech' || t.kind === 'ask')
  return {
    greetingLine: speech[0]?.text ?? `${timeOfDayGreeting()}.`,
    paragraphs: speech.slice(1).map((t) => t.text),
    readingSeconds: conv.readingSeconds,
    dataGaps: conv.turns
      .filter((t) => /don’t have enough|couldn’t load|empty/i.test(t.text))
      .map((t) => t.text),
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
      unavailableReason: 'I don’t have enough information yet.',
    }
  }
  const conv = buildMissionConversation({ displayName: null, view, loading: false })
  const mkt = conv.turns.filter((t) => t.id.startsWith('mkt'))
  return {
    title: "Today's market summary",
    paragraphs: mkt.map((t) => t.text),
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

export function buildPortfolioNarrative(view: MissionViewModel | null): PortfolioNarrative {
  const emptyNums = { totalValueUsd: null, dayChangePct: null, topWeightSymbol: null }
  if (!view) {
    return {
      title: 'Portfolio',
      healthLine: 'Waiting…',
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
      title: 'Portfolio',
      healthLine: 'Connect a wallet to interpret portfolio risk.',
      riskLabel: 'Unknown',
      weakness: null,
      suggestedAction: 'Connect your Solana wallet.',
      confidenceLabel: null,
      numbers: emptyNums,
      unavailableReason: 'No wallet connected.',
    }
  }
  if (view.portfolio.error) {
    return {
      title: 'Portfolio',
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
  const riskLabel: PortfolioNarrative['riskLabel'] =
    day == null
      ? 'Unknown'
      : Math.abs(day) >= 5
        ? 'Elevated'
        : Math.abs(day) >= 2
          ? 'Medium'
          : 'Low'
  return {
    title: 'Portfolio',
    healthLine:
      riskLabel === 'Low'
        ? 'Your portfolio is healthy on the latest 24h read.'
        : riskLabel === 'Medium'
          ? 'Operable — volatility present.'
          : riskLabel === 'Elevated'
            ? 'Under pressure on the latest 24h read.'
            : 'Not enough 24h data for a risk call.',
    riskLabel,
    weakness: view.portfolio.topWeightSymbol
      ? `Your largest weakness is concentration in ${view.portfolio.topWeightSymbol}.`
      : null,
    suggestedAction: view.portfolio.topWeightSymbol
      ? 'Monitor concentration before sizing new risk.'
      : 'Open Portfolio Intelligence for full allocation detail.',
    confidenceLabel: null,
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
      detail: 'Live observation from agent activity.',
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
    return [{ id: 'wait', text: 'I’m still loading the briefing.' }]
  }
  if (!v.market.available) {
    out.push({ id: 'm3', text: 'I don’t have enough information yet on the market.' })
  } else if ((v.market.aggregateChange24hPct ?? 0) > 1) {
    out.push({ id: 'm1', text: 'Market sample leaning constructive.' })
  } else if ((v.market.aggregateChange24hPct ?? 0) < -1) {
    out.push({ id: 'm2', text: 'Market sample leaning defensive.' })
  }
  if (v.portfolio.connected && !v.portfolio.error && v.portfolio.topWeightSymbol) {
    out.push({
      id: 'conc',
      text: `Watch concentration in ${v.portfolio.topWeightSymbol}.`,
    })
  }
  if (v.running.length > 0) {
    out.push({
      id: 'run',
      text: v.running
        .slice(0, 2)
        .map((r) => runningIntelligenceLabel(r.description, r.kind))
        .join(' '),
    })
  }
  const calibrating = params.modules.filter((m) => m.calibrating).length
  if (calibrating > 0) {
    out.push({
      id: 'cal',
      text: `${calibrating} module${calibrating === 1 ? '' : 's'} still calibrating — scores withheld.`,
    })
  }
  return out.slice(0, 5)
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

/** Memory language — not notification chrome. */
export function timelineHeadline(ev: TimelineEvent): string {
  const raw = (ev.summary || ev.eventType || '').trim()
  const lower = raw.toLowerCase()
  const type = (ev.eventType || '').toLowerCase()

  if (/liquidity|pool/.test(lower) || /liquidity/.test(type)) {
    if (/unstab|drain|drop|thin/.test(lower)) return 'Liquidity became unstable.'
    if (/stabil|recover|health/.test(lower)) return 'Liquidity stabilized.'
    return 'Liquidity changed.'
  }
  if (/whale|accumul/.test(lower) || /whale|accumul/.test(type)) {
    return 'New accumulation detected.'
  }
  if (/risk/.test(lower) || /risk|rug/.test(type)) {
    if (/improv|lower|eased/.test(lower)) return 'Portfolio risk improved.'
    if (/worsen|elevat|higher|spike/.test(lower)) return 'Portfolio risk tightened.'
    return 'Risk updated.'
  }
  if (/recommend|opportunit/.test(lower) || /recommend/.test(type)) {
    return 'Recommendation created.'
  }
  if (/report|brief/.test(lower) || /report|brief/.test(type)) {
    return 'Morning report completed.'
  }
  if (/automat|agent|job/.test(lower) || ev.sourceTable === 'agent_activity') {
    if (/finish|complete|done/.test(lower)) return 'Automation finished.'
    return 'Background intelligence updated.'
  }
  if (/order|fill|swap/.test(lower) || ev.sourceTable === 'terminal_orders') {
    return 'Execution state changed.'
  }
  // Soften alert/notification wording
  let cleaned = raw
    .replace(/^(alert|notification|warning)\s*[:\-–—]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'Something changed.'
  if (!/[.!?]$/.test(cleaned)) cleaned += '.'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function fmtSignedPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}
