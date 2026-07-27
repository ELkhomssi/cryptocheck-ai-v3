/**
 * Mission Control OS summaries — presentation only.
 * Deterministic labels from MissionViewModel. Never invents. Never chats.
 * No OpenAI. No conversational theatre.
 */

import type { ModuleCardView } from '@/types/intelligence'
import type { MissionViewModel, TimelineEvent } from '@/types/intelligence-core'

function countFromDescription(description: string): string | null {
  const m = description.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/)
  return m?.[1] ?? null
}

/** System-voice label for a live automation / agent job. */
export function runningIntelligenceLabel(description: string, kind: string): string {
  const d = (description || '').toLowerCase()
  const n = countFromDescription(description)

  if (d.includes('liquidity') || d.includes('pool')) {
    return 'Liquidity analysis running across Solana.'
  }
  if (d.includes('report') || d.includes('brief') || kind === 'report') {
    return 'Market report in progress.'
  }
  if (d.includes('portfolio') || d.includes('exposure') || d.includes('holding')) {
    return 'Portfolio exposure recalculating.'
  }
  if (d.includes('whale')) {
    return n
      ? `Monitoring ${n} whale wallets with recent movement.`
      : 'Monitoring whale wallets with recent movement.'
  }
  if (d.includes('wallet') || d.includes('holder')) {
    return n ? `Watching ${n} wallets for unusual behaviour.` : 'Watching wallets for unusual behaviour.'
  }
  if (d.includes('launch') || d.includes('listing')) {
    return n ? `Scanning ${n} new launches.` : 'Scanning new launches on Solana.'
  }
  if (d.includes('dev') || d.includes('developer')) {
    return 'Checking developer wallets tied to recent launches.'
  }
  if (d.includes('risk') || d.includes('audit') || d.includes('scam')) {
    return 'Portfolio risk recalculating.'
  }
  if (d.includes('scan') || d.includes('running your query')) {
    return 'Live scan in progress.'
  }
  if (description.trim() && !/job\s*#|queue|task\s*id|process\s*#/i.test(description)) {
    return description.trim().replace(/\.*$/, '') + '.'
  }
  return 'Market monitoring active.'
}

export type MissionMetric = { label: string; value: string }

export type MissionOsPriority = {
  id: string
  title: string
  detail: string
  level: 'High' | 'Medium' | 'Low'
}

export type MissionOsSummary = {
  statusLine: string
  marketHeadline: string
  marketDetail: string | null
  marketMetrics: MissionMetric[]
  portfolioHeadline: string
  portfolioDetail: string | null
  portfolioMetrics: MissionMetric[]
  priorities: MissionOsPriority[]
  briefTitle: string
  briefBody: string
  automationLines: string[]
  riskSymbol: string | null
  firstRun: boolean
  fetchedAt: string | null
}

function fmtSignedPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function buildMissionOsSummary(view: MissionViewModel | null): MissionOsSummary {
  if (!view) {
    return {
      statusLine: 'Intelligence Core standing by.',
      marketHeadline: 'Market sample pending.',
      marketDetail: null,
      marketMetrics: [],
      portfolioHeadline: 'Portfolio pending.',
      portfolioDetail: null,
      portfolioMetrics: [],
      priorities: [],
      briefTitle: 'Daily brief',
      briefBody: 'No brief yet.',
      automationLines: [],
      riskSymbol: null,
      firstRun: false,
      fetchedAt: null,
    }
  }

  const grounded = view.recommendations.filter((r) => r.grounded)
  const priorities: MissionOsPriority[] = grounded.slice(0, 5).map((r, i) => ({
    id: r.predictionId || `rec-${i}`,
    title: r.title,
    detail: r.explanation,
    level: i === 0 ? 'High' : i === 1 ? 'Medium' : 'Low',
  }))

  const riskSymbol =
    view.portfolio.connected && !view.portfolio.error ? view.portfolio.topWeightSymbol : null

  const marketMetrics: MissionMetric[] = []
  let marketHeadline = 'Market sample unavailable.'
  let marketDetail: string | null = null
  if (view.market.available && view.market.aggregateChange24hPct != null) {
    const chg = view.market.aggregateChange24hPct
    marketHeadline =
      chg > 2
        ? 'Market sample constructive.'
        : chg < -2
          ? 'Market sample defensive.'
          : 'Market sample orderly.'
    marketMetrics.push({ label: 'Sample 24h', value: fmtSignedPct(chg) })
    if (view.market.topMoverSymbol) {
      marketMetrics.push({
        label: 'Leading move',
        value: `${view.market.topMoverSymbol} ${fmtSignedPct(view.market.topMoverChange24hPct ?? 0)}`,
      })
      marketDetail = `Largest absolute move: ${view.market.topMoverSymbol}.`
    }
  }

  const portfolioMetrics: MissionMetric[] = []
  let portfolioHeadline = 'Wallet not connected.'
  let portfolioDetail: string | null = null
  if (!view.portfolio.connected) {
    portfolioHeadline = 'Wallet not connected.'
  } else if (view.portfolio.error) {
    portfolioHeadline = 'Portfolio holdings unavailable.'
  } else {
    const day = view.portfolio.dayChangePct
    portfolioHeadline =
      day == null
        ? 'Portfolio connected — 24h change pending.'
        : Math.abs(day) >= 5
          ? 'Portfolio under pressure.'
          : Math.abs(day) >= 2
            ? 'Portfolio operable with volatility.'
            : 'Portfolio stable on latest 24h read.'
    if (view.portfolio.totalValueUsd != null) {
      portfolioMetrics.push({ label: 'Value', value: fmtUsd(view.portfolio.totalValueUsd) })
    }
    if (day != null) portfolioMetrics.push({ label: '24h', value: fmtSignedPct(day) })
    if (riskSymbol) {
      portfolioMetrics.push({ label: 'Largest position', value: riskSymbol })
      portfolioDetail = `Primary concentration: ${riskSymbol}.`
    }
  }

  const automationLines = view.running
    .slice(0, 5)
    .map((r) => runningIntelligenceLabel(r.description, r.kind))

  const statusParts: string[] = []
  if (view.firstRun) statusParts.push('First session — limited history')
  else if (priorities.length === 0) statusParts.push('No grounded priorities')
  else statusParts.push(`${priorities.length} grounded priorit${priorities.length === 1 ? 'y' : 'ies'}`)
  if (automationLines.length > 0) {
    statusParts.push(
      `${automationLines.length} automation job${automationLines.length === 1 ? '' : 's'} live`,
    )
  } else {
    statusParts.push('Automation idle')
  }

  let briefBody = view.dailyBrief.body?.trim() || 'No brief body yet.'
  if (view.dailyBrief.insufficientActivity) {
    briefBody = 'Insufficient timeline activity for a denser brief.'
  }
  if (view.dailyBrief.pending) {
    briefBody = 'Brief pending — automation still closing the window.'
  }

  return {
    statusLine: statusParts.join(' · '),
    marketHeadline,
    marketDetail,
    marketMetrics,
    portfolioHeadline,
    portfolioDetail,
    portfolioMetrics,
    priorities,
    briefTitle: view.dailyBrief.title || 'Daily brief',
    briefBody,
    automationLines,
    riskSymbol,
    firstRun: view.firstRun,
    fetchedAt: view.fetchedAt,
  }
}

/** @deprecated Use buildMissionOsSummary — kept for tenant isolation tests. */
export function buildMissionConversation(params: {
  displayName: string | null
  view: MissionViewModel | null
  loading: boolean
}) {
  const os = buildMissionOsSummary(params.loading ? null : params.view)
  return {
    turns: os.priorities.map((p) => ({
      id: p.id,
      kind: 'speech' as const,
      text: p.title,
      proof: 'attention' as const,
      meaning: p.detail,
    })),
    preparedActions: [] as string[],
    primaryAction: '',
    suggestions: [] as string[],
    evidence: os.priorities.map((p) => p.detail),
    attention: os.priorities.map((p) => p.title),
    marketMetrics: os.marketMetrics,
    portfolioMetrics: os.portfolioMetrics,
    living: os.automationLines,
    riskSymbol: os.riskSymbol,
    readingSeconds: 0,
  }
}

export function buildPreparedActions(view: MissionViewModel): string[] {
  if (view.firstRun) return ['Connect a wallet', 'Scan a token', 'Import a watchlist']
  if (view.portfolio.connected && view.portfolio.topWeightSymbol) {
    return ['Show hidden risks', "Find today's opportunity", 'Scan a token']
  }
  if (!view.portfolio.connected) {
    return ['Review my portfolio', 'Scan a token', "Explain today's market"]
  }
  return ['Review my portfolio', "Find today's opportunity", 'Scan a token']
}

export function buildDynamicSuggestions(view: MissionViewModel): string[] {
  return buildPreparedActions(view)
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
      healthLine: 'Portfolio pending.',
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
      healthLine: 'Portfolio holdings unavailable.',
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
        ? 'Portfolio healthy on the latest 24h read.'
        : riskLabel === 'Medium'
          ? 'Operable — volatility present.'
          : riskLabel === 'Elevated'
            ? 'Under pressure on the latest 24h read.'
            : 'Not enough 24h data for a risk call.',
    riskLabel,
    weakness: view.portfolio.topWeightSymbol
      ? `Largest concentration: ${view.portfolio.topWeightSymbol}.`
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
  return buildMissionOsSummary(view).priorities
}

export type Observation = { id: string; text: string }

export function buildObservations(params: {
  view: MissionViewModel | null
  modules: ModuleCardView[]
}): Observation[] {
  const out: Observation[] = []
  const v = params.view
  if (!v) {
    return [{ id: 'wait', text: 'Intelligence Core standing by.' }]
  }
  if (!v.market.available) {
    out.push({ id: 'm3', text: 'Market sample unavailable.' })
  } else if ((v.market.aggregateChange24hPct ?? 0) > 1) {
    out.push({ id: 'm1', text: 'Market sample leaning constructive.' })
  } else if ((v.market.aggregateChange24hPct ?? 0) < -1) {
    out.push({ id: 'm2', text: 'Market sample leaning defensive.' })
  }
  if (v.portfolio.connected && !v.portfolio.error && v.portfolio.topWeightSymbol) {
    out.push({
      id: 'conc',
      text: `Concentration watch: ${v.portfolio.topWeightSymbol}.`,
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
      text: `${calibrating} module${calibrating === 1 ? '' : 's'} calibrating — scores withheld.`,
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
  let cleaned = raw
    .replace(/^(alert|notification|warning)\s*[:\-–—]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'Something changed.'
  if (!/[.!?]$/.test(cleaned)) cleaned += '.'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
