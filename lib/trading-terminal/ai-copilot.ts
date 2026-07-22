/**
 * AI Copilot — institutional intelligence assistant contracts + demo/live runners.
 * Demo: SAMPLE-tagged reasoning grounded in DEMO_SEED. Live: INSUFFICIENT DATA — never fabricate.
 * Architecture is session/context ready for future LLM, voice, and multi-agent workflows.
 */

import type { TerminalDataMode } from './data/types'
import { getDemoSeed } from './data/demo-seed'

export type CopilotMode =
  | 'token'
  | 'portfolio'
  | 'whale'
  | 'alpha'
  | 'market'
  | 'narrative'
  | 'risk'
  | 'compare'
  | 'report'
  | 'general'

export type CopilotSourceStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED'

export type CopilotSourceId =
  | 'scanner'
  | 'whale'
  | 'alpha'
  | 'portfolio'
  | 'market'
  | 'helius'
  | 'birdeye'
  | 'dexscreener'
  | 'raydium'
  | 'news'
  | 'social'
  | 'demo_seed'

export type CopilotSource = {
  id: CopilotSourceId
  label: string
  status: CopilotSourceStatus
  detail: string
}

export type CopilotTokenMetrics = {
  symbol: string
  riskScore: number
  holderQuality: number
  liquidityHealth: number
  whaleActivity: number
  alphaScore: number
  narrativeStrength: number
  confidence: number
}

export type CopilotPortfolioMetrics = {
  healthScore: number
  riskExposure: number
  sectorConcentration: number
  whaleAlignment: number
  suggestedActions: string[]
}

export type CopilotReportSection = {
  id: string
  title: string
  body: string
}

export type CopilotResponse = {
  id: string
  prompt: string
  mode: CopilotMode
  at: string
  /** True when live feeds cannot answer — never invent. */
  insufficientData: boolean
  summary: string
  keyFindings: string[]
  riskFactors: string[]
  opportunities: string[]
  confidence: number | null
  sourcesUsed: CopilotSourceId[]
  followUps: string[]
  tokenMetrics: CopilotTokenMetrics | null
  portfolioMetrics: CopilotPortfolioMetrics | null
  reportSections: CopilotReportSection[] | null
  sample: boolean
}

export type CopilotSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  pinned: boolean
  bookmarked: boolean
  prompts: string[]
  responses: CopilotResponse[]
  /** Last focus symbol for multi-step investigations */
  contextSymbol: string | null
  contextMode: CopilotMode | null
  sample: boolean
}

export type CopilotDeskBundle = {
  mode: TerminalDataMode
  sources: CopilotSource[]
  starterPrompts: string[]
  sessions: CopilotSession[]
  methodNote: string
  sample: boolean
}

const STARTER_PROMPTS = [
  'Analyze SOLCAT',
  'Why did risk increase?',
  'Show smart money accumulation today',
  'Find low-risk AI tokens',
  'Compare SOLCAT vs WHALE',
  'Find wallets similar to this wallet',
  'Explain this whale movement',
  'Analyze my portfolio',
  'Find early accumulation tokens',
  'Generate research report on SOLCAT',
]

const SOURCE_META: Array<{ id: CopilotSourceId; label: string }> = [
  { id: 'scanner', label: 'Scanner Engine' },
  { id: 'whale', label: 'Whale Engine' },
  { id: 'alpha', label: 'Alpha Engine' },
  { id: 'portfolio', label: 'Portfolio Engine' },
  { id: 'market', label: 'Market Engine' },
  { id: 'helius', label: 'Helius' },
  { id: 'birdeye', label: 'Birdeye' },
  { id: 'dexscreener', label: 'DexScreener' },
  { id: 'raydium', label: 'Raydium' },
  { id: 'news', label: 'News Sources' },
  { id: 'social', label: 'Social Sources' },
  { id: 'demo_seed', label: 'Demo Seed' },
]

export function modeLabel(mode: CopilotMode): string {
  switch (mode) {
    case 'token':
      return 'Token Analysis'
    case 'portfolio':
      return 'Portfolio Analysis'
    case 'whale':
      return 'Whale Analysis'
    case 'alpha':
      return 'Alpha Opportunities'
    case 'market':
      return 'Market Analysis'
    case 'narrative':
      return 'Narrative Analysis'
    case 'risk':
      return 'Risk Analysis'
    case 'compare':
      return 'Comparative Analysis'
    case 'report':
      return 'Research Report'
    default:
      return 'Intelligence Brief'
  }
}

export function detectCopilotMode(prompt: string, priorMode: CopilotMode | null): CopilotMode {
  const p = prompt.toLowerCase()
  if (/report|research report|executive summary|export/.test(p)) return 'report'
  if (/compar(e|ison)|vs\b|versus/.test(p)) return 'compare'
  if (/portfolio|my book|holdings|allocation/.test(p)) return 'portfolio'
  // Alpha before whale so "early accumulation tokens" routes to opportunities
  if (/alpha|opportunit|early (accumulation|entry)|under risk|low-risk|narrative leader|strongest narrative/.test(p)) {
    return 'alpha'
  }
  if (/whale|smart money|insider|cluster|wallet|accumulations? today|whale (buy|activity|movement)/.test(p)) {
    return 'whale'
  }
  if (/narrative|sector|meme|ai tokens|defi rotation/.test(p)) return 'narrative'
  if (/why.*risk|risk (score|increase|analysis)|liquidity risk/.test(p)) return 'risk'
  if (/analy[sz]e|token|bonk|wif|solcat|whale|agentx|noodle|dogeai/.test(p)) return 'token'
  if (/market|tape|breadth|flow/.test(p)) return 'market'
  if (priorMode && /why|show|compare|generate|explain|follow/.test(p)) return priorMode
  return priorMode ?? 'general'
}

export function extractSymbolHint(prompt: string, fallback: string | null): string | null {
  const seed = getDemoSeed()
  const symbols = seed.discover.map((d) => d.symbol.toUpperCase())
  const upper = prompt.toUpperCase()
  for (const s of symbols) {
    if (new RegExp(`\\b${s}\\b`).test(upper)) return s
  }
  if (/\bBONK\b/i.test(prompt) || /\bWIF\b/i.test(prompt)) return fallback ?? 'SOLCAT'
  if (/this (token|one)|it\b|the token/.test(prompt.toLowerCase()) && fallback) return fallback
  return fallback
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function demoSources(): CopilotSource[] {
  return SOURCE_META.map((s) => {
    if (s.id === 'demo_seed') {
      return { ...s, status: 'ONLINE' as const, detail: 'DEMO_SEED labeled sample desk' }
    }
    if (s.id === 'scanner' || s.id === 'market' || s.id === 'whale' || s.id === 'alpha' || s.id === 'portfolio') {
      return { ...s, status: 'DEGRADED' as const, detail: 'Demo proxy · live feed not attached' }
    }
    return { ...s, status: 'OFFLINE' as const, detail: 'Awaiting live credentials / adapters' }
  })
}

function liveSources(): CopilotSource[] {
  return SOURCE_META.map((s) => {
    if (s.id === 'demo_seed') {
      return { ...s, status: 'OFFLINE' as const, detail: 'Demo seed disabled in live mode' }
    }
    return { ...s, status: 'OFFLINE' as const, detail: 'Not connected — no fabricated status' }
  })
}

function tokenMetricsFor(symbol: string): CopilotTokenMetrics {
  const seed = getDemoSeed()
  const tok = seed.discover.find((d) => d.symbol === symbol)
  const pos = seed.positions.find((p) => p.symbol === symbol)
  const coach = seed.coach
  const isFocus = symbol === seed.focusSymbol

  const riskScore = pos?.riskScore ?? (tok?.badge === 'RISK' ? 67 : tok?.badge === 'SAFE' ? 28 : 42)
  return {
    symbol,
    riskScore,
    holderQuality: isFocus ? 74 : Math.max(40, 90 - riskScore),
    liquidityHealth: tok?.badge === 'RISK' ? 32 : isFocus ? 78 : 61,
    whaleActivity: isFocus ? 86 : symbol === 'WHALE' ? 91 : 55,
    alphaScore: isFocus ? 91 : coach.recommended.symbol === symbol ? 88 : 64,
    narrativeStrength: isFocus ? 82 : 58,
    confidence: isFocus ? 88 : 71,
  }
}

function buildTokenResponse(prompt: string, symbol: string, now: string): CopilotResponse {
  const m = tokenMetricsFor(symbol)
  const seed = getDemoSeed()
  return {
    id: uid('resp'),
    prompt,
    mode: 'token',
    at: now,
    insufficientData: false,
    summary: `${symbol} shows ${m.riskScore < 40 ? 'constructive' : m.riskScore < 55 ? 'mixed' : 'elevated'} risk with alpha ${m.alphaScore} and whale activity ${m.whaleActivity}. Demo desk analysis grounded in DEMO_SEED.`,
    keyFindings: [
      `Risk score ${m.riskScore} · holder quality ${m.holderQuality}`,
      `Liquidity health ${m.liquidityHealth} · whale activity ${m.whaleActivity}`,
      `Alpha ${m.alphaScore} · narrative strength ${m.narrativeStrength}`,
      symbol === seed.focusSymbol
        ? 'Focus token in demo desk — smart-money accumulation printed in intel tape'
        : `${symbol} present in demo discover universe`,
    ],
    riskFactors: [
      m.riskScore >= 55 ? 'Elevated risk band — size with tighter invalidation' : 'Risk within demo desk tolerance',
      m.liquidityHealth < 45 ? 'Thin liquidity — exit slippage risk' : 'Liquidity adequate for moderate tickets',
    ],
    opportunities: [
      m.alphaScore >= 75 ? 'Alpha window open on demo desk model' : 'Secondary watch — wait for stronger alpha print',
      m.whaleActivity >= 70 ? 'Whale alignment supportive' : 'Limited whale confirmation',
    ],
    confidence: m.confidence,
    sourcesUsed: ['demo_seed', 'scanner', 'whale', 'alpha'],
    followUps: [
      `Why is confidence ${m.confidence < 80 ? 'moderate' : 'high'} on ${symbol}?`,
      `Show whale activity for ${symbol}`,
      `Compare ${symbol} vs WHALE`,
      `Generate research report on ${symbol}`,
    ],
    tokenMetrics: m,
    portfolioMetrics: null,
    reportSections: null,
    sample: true,
  }
}

function buildPortfolioResponse(prompt: string, now: string): CopilotResponse {
  const seed = getDemoSeed()
  const health = seed.coach.portfolioHealth.score
  const metrics: CopilotPortfolioMetrics = {
    healthScore: health,
    riskExposure: 42,
    sectorConcentration: 37,
    whaleAlignment: 68,
    suggestedActions: seed.coach.actionQueue.slice(0, 3).map((a) => `${a.type} ${a.symbol} — ${a.reason}`),
  }
  return {
    id: uid('resp'),
    prompt,
    mode: 'portfolio',
    at: now,
    insufficientData: false,
    summary: `Portfolio health ${health}/100 with sector concentration ${metrics.sectorConcentration}% and whale alignment ${metrics.whaleAlignment}.`,
    keyFindings: [
      `Total book ~$${seed.portions.totalUsd.toLocaleString()} (demo)`,
      `PnL 24h ${seed.portions.pnl24hPct.toFixed(1)}%`,
      ...seed.coach.portfolioHealth.issues.slice(0, 2),
    ],
    riskFactors: seed.coach.threats.slice(0, 3).map((t) => `${t.symbol}: ${t.reason}`),
    opportunities: seed.coach.opportunities.slice(0, 3).map((o) => `${o.symbol} — ${o.reason}`),
    confidence: 84,
    sourcesUsed: ['demo_seed', 'portfolio', 'scanner', 'whale'],
    followUps: [
      'Show high-risk holdings',
      'Explain whale alignment',
      'Find low-risk AI tokens to diversify',
      'Generate portfolio research report',
    ],
    tokenMetrics: null,
    portfolioMetrics: metrics,
    reportSections: null,
    sample: true,
  }
}

function buildWhaleResponse(prompt: string, symbol: string | null, now: string): CopilotResponse {
  const seed = getDemoSeed()
  const whaleIntel = seed.intel.filter((e) =>
    /smart_money|whale|large_buy|accumulation/i.test(e.kind),
  )
  return {
    id: uid('resp'),
    prompt,
    mode: 'whale',
    at: now,
    insufficientData: false,
    summary: symbol
      ? `Whale / smart-money tape for ${symbol} — ${whaleIntel.filter((e) => e.symbol === symbol).length || 'related'} demo events in session window.`
      : `Smart-money accumulation leading demo tape · ${whaleIntel.length} whale-linked events.`,
    keyFindings: whaleIntel.slice(0, 4).map((e) => `${e.symbol}: ${e.headline} — ${e.detail}`),
    riskFactors: [
      'Demo whale desk is sample-tagged — not live wallet telemetry',
      ...seed.intel.filter((e) => e.kind === 'smart_money_sell').map((e) => e.headline),
    ],
    opportunities: [
      'Track SOLCAT accumulation cluster as primary demo alpha',
      'Monitor WHALE MM cluster for confirmation prints',
    ],
    confidence: 79,
    sourcesUsed: ['demo_seed', 'whale', 'helius'],
    followUps: [
      'Show insider activity',
      'Find whale clusters',
      'Analyze SOLCAT',
      'Explain this whale movement',
    ],
    tokenMetrics: symbol ? tokenMetricsFor(symbol) : null,
    portfolioMetrics: null,
    reportSections: null,
    sample: true,
  }
}

function buildAlphaResponse(prompt: string, now: string): CopilotResponse {
  const seed = getDemoSeed()
  const lowRisk = seed.discover.filter((d) => d.badge === 'SAFE' || d.badge === 'TRENDING').slice(0, 4)
  return {
    id: uid('resp'),
    prompt,
    mode: 'alpha',
    at: now,
    insufficientData: false,
    summary: 'Alpha desk (demo) surfaces early accumulation and narrative leaders from DEMO_SEED discover + coach.',
    keyFindings: [
      `Primary: ${seed.coach.recommended.symbol} · conviction ${seed.coach.recommended.convictionScore}`,
      ...lowRisk.map((d) => `${d.symbol} · ${d.badge ?? 'WATCH'} · mcap $${(d.marketCapUsd / 1e6).toFixed(1)}M`),
    ],
    riskFactors: [
      'Alpha prints can reverse without liquidity confirmation',
      'Demo opportunities are sample-tagged — not live signals',
    ],
    opportunities: seed.coach.opportunities.slice(0, 4).map((o) => `${o.symbol}: ${o.reason}`),
    confidence: 76,
    sourcesUsed: ['demo_seed', 'alpha', 'market', 'whale'],
    followUps: [
      'Find opportunities under risk score 30',
      'Find early accumulation tokens',
      'Find AI tokens with whale interest',
      'Find strongest narratives',
    ],
    tokenMetrics: tokenMetricsFor(seed.focusSymbol),
    portfolioMetrics: null,
    reportSections: null,
    sample: true,
  }
}

function buildReportResponse(prompt: string, symbol: string, now: string): CopilotResponse {
  const m = tokenMetricsFor(symbol)
  const seed = getDemoSeed()
  const sections: CopilotReportSection[] = [
    {
      id: 'exec',
      title: 'Executive Summary',
      body: `${symbol} is the ${symbol === seed.focusSymbol ? 'focus' : 'covered'} name on the demo desk with alpha ${m.alphaScore}, risk ${m.riskScore}, and confidence ${m.confidence}.`,
    },
    {
      id: 'ctx',
      title: 'Market Context',
      body: `Weekly narrative: ${seed.coach.weekly.topNarrative}. Smart-money rotation: ${seed.coach.weekly.smartMoneyRotation}.`,
    },
    {
      id: 'data',
      title: 'Data Analysis',
      body: `Holder quality ${m.holderQuality}, liquidity health ${m.liquidityHealth}, whale activity ${m.whaleActivity}, narrative strength ${m.narrativeStrength}.`,
    },
    {
      id: 'risk',
      title: 'Risk Analysis',
      body: `Primary risks: ${seed.coach.weekly.biggestRisk}. Token risk score ${m.riskScore}.`,
    },
    {
      id: 'opp',
      title: 'Opportunity Assessment',
      body: seed.coach.recommended.headline,
    },
    {
      id: 'concl',
      title: 'Conclusion',
      body: `${seed.coach.action} Confidence rating ${m.confidence}/100 (SAMPLE).`,
    },
    {
      id: 'conf',
      title: 'Confidence Rating',
      body: `${m.confidence} — demo seed coverage; export-ready structure for institutional workflows.`,
    },
  ]
  return {
    id: uid('resp'),
    prompt,
    mode: 'report',
    at: now,
    insufficientData: false,
    summary: `Research report on ${symbol} — institutional template · SAMPLE.`,
    keyFindings: sections.slice(0, 3).map((s) => `${s.title}: ${s.body.slice(0, 100)}…`),
    riskFactors: [seed.coach.weekly.biggestRisk, `Risk score ${m.riskScore}`],
    opportunities: [seed.coach.recommended.headline],
    confidence: m.confidence,
    sourcesUsed: ['demo_seed', 'scanner', 'whale', 'alpha', 'market', 'portfolio'],
    followUps: [`Why is confidence low on ${symbol}?`, `Show whale activity`, `Compare with WHALE`],
    tokenMetrics: m,
    portfolioMetrics: null,
    reportSections: sections,
    sample: true,
  }
}

function buildCompareResponse(prompt: string, now: string): CopilotResponse {
  const a = extractSymbolHint(prompt, 'SOLCAT') ?? 'SOLCAT'
  const seed = getDemoSeed()
  const others = seed.discover.map((d) => d.symbol).filter((s) => s !== a)
  const bMatch = others.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(prompt))
  const b = bMatch ?? (a === 'SOLCAT' ? 'WHALE' : 'SOLCAT')
  const ma = tokenMetricsFor(a)
  const mb = tokenMetricsFor(b)
  return {
    id: uid('resp'),
    prompt,
    mode: 'compare',
    at: now,
    insufficientData: false,
    summary: `${a} vs ${b}: alpha ${ma.alphaScore}/${mb.alphaScore}, risk ${ma.riskScore}/${mb.riskScore}, whale ${ma.whaleActivity}/${mb.whaleActivity}.`,
    keyFindings: [
      `${a} alpha ${ma.alphaScore} vs ${b} ${mb.alphaScore}`,
      `${a} risk ${ma.riskScore} vs ${b} ${mb.riskScore}`,
      `${a} liquidity ${ma.liquidityHealth} vs ${b} ${mb.liquidityHealth}`,
    ],
    riskFactors: [
      ma.riskScore > mb.riskScore ? `${a} carries higher risk in demo model` : `${b} carries higher risk in demo model`,
    ],
    opportunities: [
      ma.alphaScore >= mb.alphaScore
        ? `${a} leads on alpha in current demo print`
        : `${b} leads on alpha in current demo print`,
    ],
    confidence: Math.round((ma.confidence + mb.confidence) / 2),
    sourcesUsed: ['demo_seed', 'scanner', 'alpha', 'whale'],
    followUps: [`Analyze ${a}`, `Analyze ${b}`, `Generate research report on ${a}`],
    tokenMetrics: ma,
    portfolioMetrics: null,
    reportSections: null,
    sample: true,
  }
}

function buildRiskResponse(prompt: string, symbol: string | null, now: string): CopilotResponse {
  const seed = getDemoSeed()
  const sym = symbol ?? seed.focusSymbol
  const m = tokenMetricsFor(sym)
  return {
    id: uid('resp'),
    prompt,
    mode: 'risk',
    at: now,
    insufficientData: false,
    summary: `Risk increase drivers for ${sym}: score ${m.riskScore}, liquidity ${m.liquidityHealth}. Demo intel cites liquidity thinning on weaker names.`,
    keyFindings: [
      `Current risk ${m.riskScore}`,
      ...seed.intel.filter((e) => e.kind === 'risk_score_change').map((e) => e.detail),
    ],
    riskFactors: seed.coach.threats.map((t) => `${t.symbol}: ${t.reason}`),
    opportunities: ['Reduce size into thin names', 'Reallocate toward SAFE-band sleeves'],
    confidence: 80,
    sourcesUsed: ['demo_seed', 'scanner', 'portfolio'],
    followUps: [`Analyze ${sym}`, 'Analyze my portfolio', 'Show smart money accumulation today'],
    tokenMetrics: m,
    portfolioMetrics: null,
    reportSections: null,
    sample: true,
  }
}

function buildGeneralResponse(prompt: string, mode: CopilotMode, now: string): CopilotResponse {
  const seed = getDemoSeed()
  return {
    id: uid('resp'),
    prompt,
    mode,
    at: now,
    insufficientData: false,
    summary: `Demo intelligence brief · focus ${seed.focusSymbol}. ${seed.coach.weekly.summary}`,
    keyFindings: [
      seed.coach.recommended.headline,
      `Narrative: ${seed.coach.weekly.topNarrative}`,
      `Conviction sector: ${seed.coach.weekly.convictionSector}`,
    ],
    riskFactors: [seed.coach.weekly.biggestRisk],
    opportunities: seed.coach.opportunities.slice(0, 3).map((o) => `${o.symbol}: ${o.reason}`),
    confidence: 72,
    sourcesUsed: ['demo_seed', 'market', 'alpha'],
    followUps: STARTER_PROMPTS.slice(0, 4),
    tokenMetrics: tokenMetricsFor(seed.focusSymbol),
    portfolioMetrics: null,
    reportSections: null,
    sample: true,
  }
}

export function buildInsufficientResponse(prompt: string, mode: CopilotMode, now: string): CopilotResponse {
  return {
    id: uid('resp'),
    prompt,
    mode,
    at: now,
    insufficientData: true,
    summary: 'INSUFFICIENT DATA — live intelligence engines are not connected for this session.',
    keyFindings: [
      'Scanner / Whale / Alpha / Portfolio / Market feeds offline',
      'No fabricated analysis will be produced',
    ],
    riskFactors: ['Acting without live evidence increases blind-spot risk'],
    opportunities: ['Switch to Demo mode for SAMPLE desk walkthrough', 'Connect wallet + engine credentials for live copilot'],
    confidence: null,
    sourcesUsed: [],
    followUps: ['Analyze SOLCAT', 'Analyze my portfolio', 'Show smart money accumulation today'],
    tokenMetrics: null,
    portfolioMetrics: null,
    reportSections: null,
    sample: false,
  }
}

export function runCopilotPrompt(input: {
  prompt: string
  dataMode: TerminalDataMode
  priorMode: CopilotMode | null
  contextSymbol: string | null
}): CopilotResponse {
  const now = new Date().toISOString()
  const mode = detectCopilotMode(input.prompt, input.priorMode)
  if (input.dataMode === 'live') {
    return buildInsufficientResponse(input.prompt.trim(), mode, now)
  }

  const symbol = extractSymbolHint(input.prompt, input.contextSymbol)
  switch (mode) {
    case 'token':
      return buildTokenResponse(input.prompt, symbol ?? getDemoSeed().focusSymbol, now)
    case 'portfolio':
      return buildPortfolioResponse(input.prompt, now)
    case 'whale':
      return buildWhaleResponse(input.prompt, symbol, now)
    case 'alpha':
    case 'narrative':
      return buildAlphaResponse(input.prompt, now)
    case 'report':
      return buildReportResponse(input.prompt, symbol ?? getDemoSeed().focusSymbol, now)
    case 'compare':
      return buildCompareResponse(input.prompt, now)
    case 'risk':
      return buildRiskResponse(input.prompt, symbol, now)
    default:
      return buildGeneralResponse(input.prompt, mode, now)
  }
}

export function createCopilotSession(sample: boolean, seedTitle?: string): CopilotSession {
  const now = new Date().toISOString()
  return {
    id: uid('sess'),
    title: seedTitle ?? 'New investigation',
    createdAt: now,
    updatedAt: now,
    pinned: false,
    bookmarked: false,
    prompts: [],
    responses: [],
    contextSymbol: sample ? getDemoSeed().focusSymbol : null,
    contextMode: null,
    sample,
  }
}

export function appendToSession(session: CopilotSession, response: CopilotResponse): CopilotSession {
  const title =
    session.prompts.length === 0
      ? response.prompt.slice(0, 48) || session.title
      : session.title
  return {
    ...session,
    title,
    updatedAt: response.at,
    prompts: [...session.prompts, response.prompt],
    responses: [...session.responses, response],
    contextSymbol: response.tokenMetrics?.symbol ?? session.contextSymbol,
    contextMode: response.mode,
  }
}

export function buildCopilotDesk(mode: TerminalDataMode): CopilotDeskBundle {
  if (mode === 'demo') {
    const session = createCopilotSession(true, 'Demo · SOLCAT investigation')
    const primed = appendToSession(
      session,
      runCopilotPrompt({
        prompt: 'Analyze SOLCAT',
        dataMode: 'demo',
        priorMode: null,
        contextSymbol: 'SOLCAT',
      }),
    )
    return {
      mode,
      sources: demoSources(),
      starterPrompts: STARTER_PROMPTS,
      sessions: [primed],
      methodNote: 'ai-copilot-v1 · demo desk',
      sample: true,
    }
  }
  return {
    mode,
    sources: liveSources(),
    starterPrompts: STARTER_PROMPTS,
    sessions: [createCopilotSession(false)],
    methodNote: 'ai-copilot-v1 · live awaiting engines',
    sample: false,
  }
}

export function formatCopilotTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toISOString().slice(11, 19)
}
