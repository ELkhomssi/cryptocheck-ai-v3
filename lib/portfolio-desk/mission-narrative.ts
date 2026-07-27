/**
 * Mission Control conversation assembly — presentation only.
 * Assembles CEO conclusions from MissionViewModel. Never invents.
 *
 * Sequence: reconstruct → conclude → filter → speak → prove one-at-a-time.
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

function countFromDescription(description: string): string | null {
  const m = description.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/)
  return m?.[1] ?? null
}

export function runningIntelligenceLabel(description: string, kind: string): string {
  const d = (description || '').toLowerCase()
  const n = countFromDescription(description)

  if (d.includes('liquidity') || d.includes('pool')) {
    return 'I’m currently analyzing liquidity across Solana.'
  }
  if (d.includes('report') || d.includes('brief') || kind === 'report') {
    return 'Today’s market report is still being prepared.'
  }
  if (d.includes('portfolio') || d.includes('exposure') || d.includes('holding')) {
    return 'Recalculating portfolio exposure…'
  }
  if (d.includes('whale')) {
    return n
      ? `I’m monitoring ${n} whale wallets that moved while you were away.`
      : 'I’m monitoring whale wallets that moved while you were away.'
  }
  if (d.includes('wallet') || d.includes('holder')) {
    return n ? `I’m watching ${n} wallets for unusual behaviour.` : 'I’m watching wallets for unusual behaviour.'
  }
  if (d.includes('launch') || d.includes('listing')) {
    return n ? `I’m scanning ${n} new launches.` : 'I’m scanning new launches on Solana.'
  }
  if (d.includes('dev') || d.includes('developer')) {
    return 'I’m checking developer wallets tied to recent launches.'
  }
  if (d.includes('risk') || d.includes('audit') || d.includes('scam')) {
    return 'I’m recalculating portfolio risk.'
  }
  if (d.includes('scan') || d.includes('running your query')) {
    return 'I’m running a live scan for you.'
  }
  if (description.trim() && !/job\s*#|queue|task\s*id|process\s*#/i.test(description)) {
    return description.trim().replace(/\.*$/, '') + '…'
  }
  return 'I’m continuing to monitor the market.'
}

export type SpeechProof =
  | 'none'
  | 'living'
  | 'feed'
  | 'market'
  | 'portfolio'
  | 'attention'
  | 'actions'

export type SpeechTurn = {
  id: string
  kind: 'speech' | 'propose'
  text: string
  proof: SpeechProof
  meaning: string | null
}

export type MissionMetric = { label: string; value: string }

export type ReconstructStep = {
  id: string
  engine: string
  status: string
  done: boolean
}

export type MissionConversation = {
  turns: SpeechTurn[]
  preparedActions: string[]
  primaryAction: string
  suggestions: string[]
  evidence: string[]
  attention: string[]
  marketMetrics: MissionMetric[]
  portfolioMetrics: MissionMetric[]
  living: string[]
  riskSymbol: string | null
  reconstruction: ReconstructStep[]
  readingSeconds: number
}

export function speechHoldMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1600, Math.min(4200, 1100 + words * 160))
}

export function activeProofAt(turns: SpeechTurn[], spokenCount: number): SpeechProof {
  const i = Math.min(spokenCount, turns.length) - 1
  if (i < 0) return 'none'
  return turns[i]?.proof ?? 'none'
}

export function proofsUnlockedThrough(turns: SpeechTurn[], spokenCount: number): SpeechProof[] {
  const seen = new Set<SpeechProof>()
  const out: SpeechProof[] = []
  for (let i = 0; i < Math.min(spokenCount, turns.length); i++) {
    const p = turns[i]!.proof
    if (p === 'none' || seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

export function buildReconstruction(params: {
  view: MissionViewModel | null
  loading: boolean
}): ReconstructStep[] {
  const v = params.view
  const loading = params.loading || !v
  return [
    {
      id: 'market',
      engine: 'Market Intelligence',
      status: loading
        ? 'Reconstructing…'
        : v!.market.available
          ? 'Conclusion ready.'
          : 'Insufficient sample.',
      done: !loading,
    },
    {
      id: 'portfolio',
      engine: 'Portfolio Intelligence',
      status: loading
        ? 'Reconstructing…'
        : !v!.portfolio.connected
          ? 'Wallet not connected.'
          : v!.portfolio.error
            ? 'Holdings unavailable.'
            : 'Conclusion ready.',
      done: !loading,
    },
    {
      id: 'feed',
      engine: 'Mission Feed · Timeline',
      status: loading
        ? 'Reconstructing…'
        : v!.dailyBrief.insufficientActivity
          ? 'Quiet window.'
          : 'Events reviewed.',
      done: !loading,
    },
    {
      id: 'automation',
      engine: 'Automation · Agent Activity',
      status: loading
        ? 'Reconstructing…'
        : v!.running.length > 0
          ? `${v!.running.length} live job${v!.running.length === 1 ? '' : 's'}.`
          : 'Idle — still monitoring.',
      done: !loading,
    },
    {
      id: 'recommend',
      engine: 'Recommendation Engine',
      status: loading
        ? 'Reconstructing…'
        : v!.recommendations.some((r) => r.grounded)
          ? 'Priorities filtered.'
          : 'Nothing requires action.',
      done: !loading,
    },
  ]
}

const ONBOARD_ACTIONS = [
  'Connect a wallet',
  'Scan a token',
  'Import a watchlist',
] as const

const PREPARED_ACTIONS = [
  'Review my portfolio',
  "Find today's opportunity",
  'Scan a token',
  "Explain today's market",
  'Show hidden risks',
] as const

function pickPrimaryAction(view: MissionViewModel): string {
  if (view.firstRun) return 'Scan a token'
  const grounded = view.recommendations.find((r) => r.grounded)
  if (grounded) return "Find today's opportunity"
  if (view.portfolio.connected && view.portfolio.topWeightSymbol) return 'Show hidden risks'
  if (!view.portfolio.connected) return 'Review my portfolio'
  if (!view.market.available) return "Explain today's market"
  return 'Review my portfolio'
}

export function buildPreparedActions(view: MissionViewModel): string[] {
  if (view.firstRun) return [...ONBOARD_ACTIONS]
  const primary = pickPrimaryAction(view)
  const rest = PREPARED_ACTIONS.filter((a) => a !== primary)
  return [primary, ...rest]
}

export function buildMissionConversation(params: {
  displayName: string | null
  view: MissionViewModel | null
  loading: boolean
}): MissionConversation {
  const reconstruction = buildReconstruction({
    view: params.view,
    loading: params.loading,
  })

  if (params.loading || !params.view) {
    const preparedActions = [...PREPARED_ACTIONS].slice(0, 3)
    return {
      turns: [],
      preparedActions,
      primaryAction: preparedActions[0]!,
      suggestions: preparedActions,
      evidence: [],
      attention: [],
      marketMetrics: [],
      portfolioMetrics: [],
      living: [],
      riskSymbol: null,
      reconstruction,
      readingSeconds: 6,
    }
  }

  const v = params.view
  const turns: SpeechTurn[] = []
  const evidence: string[] = []
  const attention: string[] = []
  const marketMetrics: MissionMetric[] = []
  const portfolioMetrics: MissionMetric[] = []
  const name = params.displayName?.trim()
  const grounded = v.recommendations.filter((r) => r.grounded).slice(0, 2)
  const preparedActions = buildPreparedActions(v).slice(0, 3)
  const primaryAction = preparedActions[0]!
  const living = v.running.slice(0, 3).map((r) => runningIntelligenceLabel(r.description, r.kind))
  const riskSymbol =
    v.portfolio.connected && !v.portfolio.error ? v.portfolio.topWeightSymbol : null

  const marketMissing = !v.market.available || v.market.aggregateChange24hPct == null
  const portfolioMissing = !v.portfolio.connected || Boolean(v.portfolio.error)
  const quiet =
    !v.firstRun &&
    marketMissing &&
    (portfolioMissing || (v.portfolio.dayChangePct != null && Math.abs(v.portfolio.dayChangePct) < 2)) &&
    grounded.length === 0 &&
    v.dailyBrief.insufficientActivity

  turns.push({
    id: 'greet',
    kind: 'speech',
    text: name ? `${timeOfDayGreeting()} ${name}.` : `${timeOfDayGreeting()}.`,
    proof: 'none',
    meaning: v.firstRun
      ? 'You’re new here — I’ll keep this short until we have history to work with.'
      : 'I’ve already reconstructed your operating picture.',
  })

  if (v.firstRun) {
    turns.push({
      id: 'onboard',
      kind: 'speech',
      text: 'This is your first run. I don’t have history for you yet.',
      proof: 'actions',
      meaning:
        'Connect a wallet, run a first token scan, or import a watchlist — then I’ll reconstruct from real activity.',
    })
  } else if (quiet) {
    turns.push({
      id: 'quiet',
      kind: 'speech',
      text: 'Today has been relatively quiet. Nothing requires your attention.',
      proof: 'feed',
      meaning: 'I filtered Mission Feed and automation — no priority items.',
    })
  } else {
    if (!marketMissing) {
      const chg = v.market.aggregateChange24hPct!
      turns.push({
        id: 'mkt',
        kind: 'speech',
        text:
          chg > 2
            ? 'The market is strengthening.'
            : chg < -2
              ? 'The market turned defensive.'
              : 'The market remains orderly.',
        proof: 'market',
        meaning:
          v.market.topMoverSymbol != null
            ? `Main pressure sits around ${v.market.topMoverSymbol}.`
            : 'Live sample supports this read.',
      })
      marketMetrics.push({ label: 'Sample 24h', value: fmtSignedPct(chg) })
      evidence.push(`Live sample aggregate 24h change: ${fmtSignedPct(chg)}.`)
      if (v.market.topMoverSymbol) {
        marketMetrics.push({
          label: 'Leading move',
          value: `${v.market.topMoverSymbol} ${fmtSignedPct(v.market.topMoverChange24hPct ?? 0)}`,
        })
        evidence.push(
          `Largest absolute move: ${v.market.topMoverSymbol} at ${fmtSignedPct(v.market.topMoverChange24hPct ?? 0)}.`,
        )
      }
    }

    if (v.portfolio.connected && !v.portfolio.error) {
      const day = v.portfolio.dayChangePct
      const healthy = day != null && Math.abs(day) < 2
      const stressed = day != null && Math.abs(day) >= 5
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: healthy
          ? 'Your portfolio remains healthy.'
          : stressed
            ? 'Your portfolio is under pressure.'
            : day == null
              ? 'I don’t have enough information yet on portfolio risk.'
              : 'Your portfolio is stable, with volatility to watch.',
        proof: 'portfolio',
        meaning: riskSymbol
          ? `Concentration in ${riskSymbol} is what can hurt you first.`
          : 'No single concentration stands out yet.',
      })

      if (riskSymbol && (stressed || !healthy)) {
        turns.push({
          id: 'pf-risk',
          kind: 'speech',
          text: `${riskSymbol} deserves review before tomorrow.`,
          proof: 'portfolio',
          meaning: 'This is the only portfolio item I’m elevating.',
        })
        attention.push(`Review concentration in ${riskSymbol}.`)
      } else if (riskSymbol) {
        attention.push(`Watch concentration in ${riskSymbol}.`)
      }

      if (v.portfolio.totalValueUsd != null) {
        portfolioMetrics.push({
          label: 'Portfolio value',
          value: `$${v.portfolio.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        })
        evidence.push(
          `Portfolio value: ~$${v.portfolio.totalValueUsd.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}${day != null ? ` · 24h ${fmtSignedPct(day)}` : ''}.`,
        )
      }
      if (day != null) portfolioMetrics.push({ label: 'Portfolio 24h', value: fmtSignedPct(day) })
      if (riskSymbol) portfolioMetrics.push({ label: 'Largest position', value: riskSymbol })
    } else if (!v.portfolio.connected) {
      turns.push({
        id: 'pf',
        kind: 'speech',
        text: 'Connect a wallet when you want portfolio judgement.',
        proof: 'portfolio',
        meaning: 'I can’t manage what I can’t see.',
      })
    }

    if (grounded.length > 0) {
      turns.push({
        id: 'opp',
        kind: 'speech',
        text:
          grounded.length === 1
            ? 'One item deserves your attention.'
            : `${grounded.length} items deserve your attention.`,
        proof: 'attention',
        meaning: grounded[0]!.title,
      })
      for (const g of grounded) {
        attention.push(g.title)
        evidence.push(g.explanation)
      }
    }

    if (living.length > 0) {
      turns.push({
        id: 'living',
        kind: 'speech',
        text: living[0]!,
        proof: 'living',
        meaning: 'Live agent activity from Automation.',
      })
    }
  }

  turns.push({
    id: 'propose',
    kind: 'propose',
    text: v.firstRun
      ? 'I’ve prepared a first step and filtered everything else.'
      : 'I filtered everything else. Choose what we open next.',
    proof: 'actions',
    meaning: v.firstRun
      ? 'Start with one action — no briefing filler until you have history.'
      : `${preparedActions.length} actions are prepared from the briefing.`,
  })

  const full = turns.map((t) => t.text).join(' ')
  return {
    turns,
    preparedActions,
    primaryAction,
    suggestions: preparedActions,
    evidence: evidence.slice(0, 5),
    attention: attention.slice(0, 5),
    marketMetrics,
    portfolioMetrics,
    living,
    riskSymbol,
    reconstruction,
    readingSeconds: estimateReadingSeconds(full),
  }
}

export function buildDynamicSuggestions(view: MissionViewModel): string[] {
  return buildPreparedActions(view)
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
  const conv = buildMissionConversation(params)
  const speech = conv.turns.filter((t) => t.kind === 'speech' || t.kind === 'propose')
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
    return [{ id: 'wait', text: 'I’m still reconstructing the operating picture.' }]
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

function fmtSignedPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}
