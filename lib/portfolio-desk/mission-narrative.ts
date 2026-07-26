/**
 * Mission Control conversation assembly — presentation only.
 * Assembles speech from MissionViewModel. Never invents activity.
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
  if (d.includes('dev') || d.includes('developer')) return 'Checking developer wallets…'
  if (d.includes('report') || d.includes('brief') || kind === 'report')
    return 'Building today’s opportunities…'
  if (d.includes('risk') || d.includes('audit') || d.includes('scam') || d.includes('portfolio'))
    return 'Analyzing portfolio risk…'
  if (d.includes('scan') || d.includes('running your query')) return 'Scanning…'
  if (description.trim()) return description.trim()
  return 'Working…'
}

export type SpeechTurn = {
  id: string
  /** Conversation blocks — no cards, no metric grids. */
  kind: 'speech' | 'aside' | 'live' | 'ask'
  text: string
}

export type MissionConversation = {
  turns: SpeechTurn[]
  suggestions: string[]
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
      suggestions: ['Explain today\'s market', 'Review my portfolio'],
      readingSeconds: 8,
    }
  }

  const v = params.view
  const turns: SpeechTurn[] = []
  const name = params.displayName?.trim()
  turns.push({
    id: 'greet',
    kind: 'speech',
    text: name ? `${timeOfDayGreeting()} ${name}.` : `${timeOfDayGreeting()}.`,
  })

  // —— Market speech ——
  if (!v.market.available || v.market.aggregateChange24hPct == null) {
    turns.push({
      id: 'mkt-gap',
      kind: 'speech',
      text: 'I don’t have enough market activity yet to brief you on direction. The live screener sample came back empty.',
    })
  } else {
    const chg = v.market.aggregateChange24hPct
    if (chg > 2) {
      turns.push({
        id: 'mkt',
        kind: 'speech',
        text: 'The market has become more aggressive. The live sample is in a risk-on posture.',
      })
    } else if (chg < -2) {
      turns.push({
        id: 'mkt',
        kind: 'speech',
        text: 'The market has turned defensive. The live sample is risk-off right now.',
      })
    } else {
      turns.push({
        id: 'mkt',
        kind: 'speech',
        text: 'The market is relatively balanced — no decisive risk-on or risk-off signal in the live sample.',
      })
    }

    const reasons: string[] = []
    reasons.push(`Aggregate 24h change across the sample is ${fmtSignedPct(chg)}.`)
    if (v.market.topMoverSymbol) {
      reasons.push(
        `${v.market.topMoverSymbol} leads absolute movement at ${fmtSignedPct(v.market.topMoverChange24hPct ?? 0)}.`,
      )
    }
    if (v.market.spark.length >= 4) {
      const up = v.market.spark.filter((x) => x > 0).length
      reasons.push(`${up} of the first ${v.market.spark.length} names print green on 24h.`)
    }
    turns.push({
      id: 'mkt-why',
      kind: 'aside',
      text: reasons.join(' '),
    })
  }

  // —— Portfolio speech (decisions, not balances) ——
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
      text: 'I couldn’t load portfolio intelligence just now — the holdings request failed. Nothing invented in its place.',
    })
  } else {
    const day = v.portfolio.dayChangePct
    const safe =
      day == null ? null : Math.abs(day) < 2 ? 'safely' : Math.abs(day) < 5 ? 'with medium volatility' : 'under pressure'

    if (safe === 'safely') {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'Your portfolio is positioned safely on the latest 24h read.',
      })
    } else if (safe === 'with medium volatility') {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'Your portfolio is operable, but volatility is present — not extreme.',
      })
    } else if (safe === 'under pressure') {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'Your portfolio is under pressure on the latest 24h read.',
      })
    } else {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'I have portfolio value, but not enough 24h change to call risk confidently.',
      })
    }

    if (v.portfolio.topWeightSymbol) {
      turns.push({
        id: 'pf-risk',
        kind: 'speech',
        text: `However — one position deserves your attention. Your biggest concentration is ${v.portfolio.topWeightSymbol}. That is the first risk to monitor before you size anything new.`,
      })
      turns.push({
        id: 'pf-act',
        kind: 'aside',
        text: `What changed: 24h ${day != null ? fmtSignedPct(day) : 'unavailable'}. Suggested next step: review concentration, then decide whether to trim, hold, or hedge — I won’t invent a sell/buy without a grounded recommendation.`,
      })
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
          ? `I found one opportunity worth reviewing: ${grounded[0]!.title}. ${grounded[0]!.explanation}`
          : `I found ${Math.min(2, grounded.length)} opportunities worth reviewing. First: ${grounded[0]!.title}. ${grounded[0]!.explanation}`,
    })
    if (grounded[1]) {
      turns.push({
        id: 'opp-2',
        kind: 'aside',
        text: `Second: ${grounded[1].title}. ${grounded[1].explanation}`,
      })
    }
  } else if (v.dailyBrief.insufficientActivity) {
    turns.push({
      id: 'opp-gap',
      kind: 'speech',
      text: 'I don’t have enough timeline activity yet for denser opportunities.',
    })
  }

  // —— Live work ——
  if (v.running.length > 0) {
    turns.push({
      id: 'live',
      kind: 'live',
      text: v.running
        .slice(0, 4)
        .map((r) => runningIntelligenceLabel(r.description, r.kind))
        .join('\n'),
    })
  } else {
    turns.push({
      id: 'live-idle',
      kind: 'aside',
      text: 'Nothing critical is running in the background right now.',
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
    out.push('Explain today’s market')
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
    out.push('What are you working on?')
  } else {
    out.push('Track this wallet')
  }

  // Dedupe, cap
  const seen = new Set<string>()
  const unique: string[] = []
  for (const s of out) {
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(s)
    if (unique.length >= 5) break
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
      unavailableReason: 'I don’t have enough market activity yet.',
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
        ? 'Positioned safely on the latest 24h read.'
        : riskLabel === 'Medium'
          ? 'Operable — volatility present.'
          : riskLabel === 'Elevated'
            ? 'Under pressure on the latest 24h read.'
            : 'Not enough 24h data for a risk call.',
    riskLabel,
    weakness: view.portfolio.topWeightSymbol
      ? `Biggest concentration: ${view.portfolio.topWeightSymbol}.`
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
      detail: 'Live job from agent activity.',
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
    out.push({ id: 'm3', text: 'I don’t have enough market activity yet.' })
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
  if (v.running.length === 0) {
    out.push({ id: 'idle', text: 'No critical background jobs running.' })
  } else {
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

export function timelineHeadline(ev: TimelineEvent): string {
  return ev.summary || ev.eventType
}

function fmtSignedPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}
