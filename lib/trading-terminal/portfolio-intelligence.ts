/**
 * Portfolio Intelligence Center — personal portfolio intelligence contracts + builders.
 * Demo: labeled SAMPLE desk from DEMO_SEED. Live: empty awaiting wallet — never fabricate.
 */

import type { TerminalDataMode } from './data/types'
import { getDemoSeed } from './data/demo-seed'

export type PortfolioSectorId =
  | 'AI'
  | 'Meme'
  | 'Gaming'
  | 'DeFi'
  | 'RWA'
  | 'Infrastructure'
  | 'Stable'
  | 'Native'

export type PortfolioRiskBand = 'high' | 'medium' | 'low'
export type HiddenRiskSeverity = 'INFO' | 'WARNING' | 'CRITICAL'
export type AllocationKind = 'asset' | 'sector' | 'risk' | 'liquidity'

export type PortfolioHolding = {
  id: string
  mint: string
  symbol: string
  name: string
  valueUsd: number
  pnlUsd: number
  pnlPct: number
  weightPct: number
  riskScore: number
  riskBand: PortfolioRiskBand
  sector: PortfolioSectorId
  liquidityScore: number
  verdict: 'SAFE' | 'CAUTION' | 'DANGER' | null
  sample: boolean
}

export type PortfolioSummary = {
  totalValueUsd: number
  totalPnlUsd: number
  totalPnlPct: number
  portfolioRiskScore: number
  holdingsCount: number
  smartMoneyAlignment: number
  portfolioHealthScore: number
  sample: boolean
}

export type AllocationSlice = {
  id: string
  label: string
  pct: number
  valueUsd: number
  tone?: 'pos' | 'warn' | 'neg' | 'neutral'
}

export type PortfolioAllocations = {
  asset: AllocationSlice[]
  sector: AllocationSlice[]
  risk: AllocationSlice[]
  liquidity: AllocationSlice[]
}

export type PortfolioRiskAnalysis = {
  highRiskHoldings: number
  mediumRiskHoldings: number
  lowRiskHoldings: number
  rugExposure: number
  concentrationRisk: number
  liquidityRisk: number
  portfolioRiskScore: number
  note: string
  sample: boolean
}

export type SmartMoneyAlignment = {
  alignmentScore: number
  sharedHoldings: Array<{ symbol: string; mint: string; overlapPct: number }>
  sharedNarratives: string[]
  whaleOverlap: number
  note: string
  sample: boolean
}

export type HiddenRiskFinding = {
  id: string
  severity: HiddenRiskSeverity
  title: string
  detail: string
  symbol: string | null
  mint: string | null
  sample: boolean
}

export type PortfolioAiInsights = {
  healthLabel: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' | 'Unavailable'
  strengths: string[]
  risks: string[]
  suggestedActions: string[]
  sample: boolean
}

export type PortfolioIntelligenceBundle = {
  mode: TerminalDataMode
  summary: PortfolioSummary
  holdings: PortfolioHolding[]
  allocations: PortfolioAllocations
  risk: PortfolioRiskAnalysis
  alignment: SmartMoneyAlignment
  hiddenRisks: HiddenRiskFinding[]
  insights: PortfolioAiInsights
  methodNote: string
  sample: boolean
  liveNote: string | null
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function riskBand(score: number): PortfolioRiskBand {
  if (score >= 55) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

export function formatPortUsd(n: number, compact = true): string {
  const sign = n < 0 ? '−' : ''
  const abs = Math.abs(n)
  if (compact) {
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`
  }
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function formatPortPct(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(1)}%`
}

export function formatPortUsdSigned(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  const abs = Math.abs(n)
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function sectorForSymbol(symbol: string): PortfolioSectorId {
  switch (symbol) {
    case 'DOGEAI':
    case 'AGENTX':
    case 'PEPEAI':
      return 'AI'
    case 'SOLCAT':
    case 'NOODLE':
      return 'Meme'
    case 'WHALE':
    case 'LAUNCH':
      return 'DeFi'
    case 'INFRA':
    case 'ORBIT':
      return 'Infrastructure'
    case 'RIFT':
    case 'NEON':
      return 'Gaming'
    case 'PULSE':
      return 'RWA'
    case 'SOL':
      return 'Native'
    case 'USDC':
      return 'Stable'
    default:
      return 'Meme'
  }
}

function demoHoldings(): PortfolioHolding[] {
  const seed = getDemoSeed()
  const total = seed.portions.totalUsd
  const nameByMint = Object.fromEntries(seed.discover.map((d) => [d.mint, d.name]))

  const cashSlices = seed.portions.legend.filter((l) => l.name === 'SOL' || l.name === 'USDC')
  const positions = seed.positions.map((p) => {
    const weightPct = total > 0 ? (p.valueUsd / total) * 100 : 0
    return {
      id: `h-${p.mint}`,
      mint: p.mint,
      symbol: p.symbol,
      name: nameByMint[p.mint] ?? p.symbol,
      valueUsd: p.valueUsd,
      pnlUsd: p.pnlUsd,
      pnlPct: p.pnlPct,
      weightPct,
      riskScore: p.riskScore,
      riskBand: riskBand(p.riskScore),
      sector: sectorForSymbol(p.symbol),
      liquidityScore: p.verdict === 'DANGER' ? 28 : p.verdict === 'CAUTION' ? 52 : 78,
      verdict: (p.verdict as PortfolioHolding['verdict']) ?? null,
      sample: true as const,
    }
  })

  const extras: PortfolioHolding[] = cashSlices.map((c) => ({
    id: `h-cash-${c.name}`,
    mint: c.name === 'SOL' ? 'So11111111111111111111111111111111111111112' : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: c.name,
    name: c.name === 'SOL' ? 'Solana' : 'USD Coin',
    valueUsd: c.valueUsd,
    pnlUsd: c.name === 'SOL' ? 412 : 0,
    pnlPct: c.name === 'SOL' ? 5.5 : 0,
    weightPct: c.pct,
    riskScore: c.name === 'SOL' ? 18 : 5,
    riskBand: 'low' as const,
    sector: sectorForSymbol(c.name),
    liquidityScore: 95,
    verdict: 'SAFE' as const,
    sample: true,
  }))

  return [...extras, ...positions].sort((a, b) => b.valueUsd - a.valueUsd)
}

function buildAllocations(holdings: PortfolioHolding[]): PortfolioAllocations {
  const total = holdings.reduce((a, h) => a + h.valueUsd, 0) || 1

  const group = (
    keyFn: (h: PortfolioHolding) => string,
    toneFn?: (label: string) => AllocationSlice['tone'],
  ): AllocationSlice[] => {
    const map = new Map<string, number>()
    for (const h of holdings) {
      const k = keyFn(h)
      map.set(k, (map.get(k) ?? 0) + h.valueUsd)
    }
    return [...map.entries()]
      .map(([label, valueUsd]) => ({
        id: label,
        label,
        valueUsd,
        pct: (valueUsd / total) * 100,
        tone: toneFn?.(label),
      }))
      .sort((a, b) => b.pct - a.pct)
  }

  const liqBucket = (s: number) => (s >= 70 ? 'Deep' : s >= 45 ? 'Adequate' : 'Thin')

  return {
    asset: holdings.slice(0, 8).map((h) => ({
      id: h.mint,
      label: h.symbol,
      pct: h.weightPct,
      valueUsd: h.valueUsd,
      tone: h.riskBand === 'high' ? 'neg' : h.riskBand === 'medium' ? 'warn' : 'pos',
    })),
    sector: group((h) => h.sector),
    risk: group((h) => h.riskBand.toUpperCase(), (label) => {
      if (label === 'HIGH') return 'neg'
      if (label === 'MEDIUM') return 'warn'
      return 'pos'
    }),
    liquidity: group((h) => liqBucket(h.liquidityScore), (label) => {
      if (label === 'Thin') return 'neg'
      if (label === 'Adequate') return 'warn'
      return 'pos'
    }),
  }
}

function buildRisk(holdings: PortfolioHolding[]): PortfolioRiskAnalysis {
  const high = holdings.filter((h) => h.riskBand === 'high')
  const med = holdings.filter((h) => h.riskBand === 'medium')
  const low = holdings.filter((h) => h.riskBand === 'low')
  const total = holdings.reduce((a, h) => a + h.valueUsd, 0) || 1
  const top = holdings[0]
  const concentrationRisk = top ? clamp(top.weightPct * 1.4, 0, 100) : 0
  const rugExposure = clamp(
    (high.reduce((a, h) => a + h.valueUsd, 0) / total) * 100 + high.length * 4,
    0,
    100,
  )
  const thin = holdings.filter((h) => h.liquidityScore < 45)
  const liquidityRisk = clamp(
    (thin.reduce((a, h) => a + h.valueUsd, 0) / total) * 120 + thin.length * 6,
    0,
    100,
  )
  const portfolioRiskScore = Math.round(
    clamp(
      high.length * 14 +
        med.length * 6 +
        concentrationRisk * 0.35 +
        rugExposure * 0.25 +
        liquidityRisk * 0.2,
      0,
      100,
    ),
  )

  return {
    highRiskHoldings: high.length,
    mediumRiskHoldings: med.length,
    lowRiskHoldings: low.length,
    rugExposure: Math.round(rugExposure),
    concentrationRisk: Math.round(concentrationRisk),
    liquidityRisk: Math.round(liquidityRisk),
    portfolioRiskScore,
    note: 'Composite of holding risk bands, concentration, and liquidity thinness.',
    sample: true,
  }
}

function buildAlignment(holdings: PortfolioHolding[]): SmartMoneyAlignment {
  const tracked = new Set(['WHALE', 'AGENTX', 'SOLCAT', 'DOGEAI'])
  const shared = holdings
    .filter((h) => tracked.has(h.symbol))
    .map((h) => ({
      symbol: h.symbol,
      mint: h.mint,
      overlapPct: Math.round(clamp(40 + h.weightPct, 0, 95)),
    }))
  const narratives = [
    ...new Set(
      holdings
        .filter((h) => tracked.has(h.symbol) || h.sector === 'AI' || h.sector === 'DeFi')
        .map((h) => h.sector),
    ),
  ].slice(0, 4)
  const alignmentScore = clamp(38 + shared.length * 12 + narratives.length * 4, 0, 96)
  const whaleOverlap = clamp(shared.length * 18 + 12, 0, 100)

  return {
    alignmentScore: Math.round(alignmentScore),
    sharedHoldings: shared,
    sharedNarratives: narratives.length ? narratives : ['—'],
    whaleOverlap: Math.round(whaleOverlap),
    note: 'Similarity vs tracked smart-money desk wallets (demo cohort).',
    sample: true,
  }
}

function buildHiddenRisks(holdings: PortfolioHolding[]): HiddenRiskFinding[] {
  const findings: HiddenRiskFinding[] = []
  const noodle = holdings.find((h) => h.symbol === 'NOODLE')
  if (noodle) {
    findings.push({
      id: 'hr1',
      severity: 'CRITICAL',
      title: 'Thin liquidity position',
      detail: `${noodle.symbol} liquidity score ${noodle.liquidityScore} · exit slippage risk elevated`,
      symbol: noodle.symbol,
      mint: noodle.mint,
      sample: true,
    })
    findings.push({
      id: 'hr2',
      severity: 'WARNING',
      title: 'Suspicious developer holdings pattern',
      detail: 'NOODLE deployer-prox cluster activity correlated with book risk rise',
      symbol: noodle.symbol,
      mint: noodle.mint,
      sample: true,
    })
  }
  const top = holdings[0]
  if (top && top.weightPct >= 25) {
    findings.push({
      id: 'hr3',
      severity: 'WARNING',
      title: 'Whale concentration in book',
      detail: `${top.symbol} is ${top.weightPct.toFixed(0)}% of portfolio — concentration threshold exceeded`,
      symbol: top.symbol,
      mint: top.mint,
      sample: true,
    })
  }
  findings.push({
    id: 'hr4',
    severity: 'INFO',
    title: 'Mutable mint exposure scan',
    detail: 'No mutable-mint flags on SOL/USDC sleeves; token book pending continuous rescans',
    symbol: null,
    mint: null,
    sample: true,
  })
  findings.push({
    id: 'hr5',
    severity: 'INFO',
    title: 'Liquidity lock coverage',
    detail: 'Primary DeFi holdings show adequate lock proxies in demo desk model',
    symbol: 'WHALE',
    mint: holdings.find((h) => h.symbol === 'WHALE')?.mint ?? null,
    sample: true,
  })
  return findings
}

function buildInsights(
  risk: PortfolioRiskAnalysis,
  alignment: SmartMoneyAlignment,
  holdings: PortfolioHolding[],
): PortfolioAiInsights {
  const health =
    risk.portfolioRiskScore <= 28
      ? 'Excellent'
      : risk.portfolioRiskScore <= 42
        ? 'Good'
        : risk.portfolioRiskScore <= 58
          ? 'Fair'
          : risk.portfolioRiskScore <= 75
            ? 'Poor'
            : 'Critical'

  const strengths: string[] = []
  const risks: string[] = []
  const suggestedActions: string[] = []

  if (risk.lowRiskHoldings >= risk.highRiskHoldings) {
    strengths.push('Majority of sleeves in low/medium risk bands')
  }
  if (alignment.alignmentScore >= 55) {
    strengths.push('Constructive smart-money alignment on shared names')
  }
  const deepLiq = holdings.filter((h) => h.liquidityScore >= 70).length
  if (deepLiq >= 2) strengths.push('Strong liquidity profile on core holdings')

  const divers = new Set(holdings.map((h) => h.sector)).size
  if (divers >= 3) strengths.push('Healthy sector diversification across book')

  if (risk.highRiskHoldings > 0) {
    risks.push(`${risk.highRiskHoldings} holding${risk.highRiskHoldings > 1 ? 's' : ''} in high-risk band`)
  }
  if (risk.concentrationRisk >= 40) {
    risks.push(`${risk.concentrationRisk} concentration score — top weight elevated`)
  }
  const exit = holdings.find((h) => h.symbol === 'NOODLE')
  if (exit) risks.push(`${exit.symbol} shows whale exit / thinning liquidity pattern`)

  for (const h of holdings.filter((x) => x.riskBand === 'high').slice(0, 2)) {
    suggestedActions.push(`Reduce exposure to ${h.symbol}`)
  }
  for (const h of holdings.filter((x) => x.riskBand === 'medium').slice(0, 2)) {
    suggestedActions.push(`Monitor ${h.symbol}`)
  }
  if (suggestedActions.length === 0) {
    suggestedActions.push('Maintain core sleeves · rebalance on next risk scan')
  }

  return {
    healthLabel: health,
    strengths: strengths.length ? strengths : ['Book structure within desk tolerances'],
    risks: risks.length ? risks : ['No material desk risks flagged'],
    suggestedActions,
    sample: true,
  }
}

function buildDemoBundle(): PortfolioIntelligenceBundle {
  const holdings = demoHoldings()
  const risk = buildRisk(holdings)
  const alignment = buildAlignment(holdings)
  const seed = getDemoSeed()
  const healthScore = clamp(100 - risk.portfolioRiskScore * 0.85 + alignment.alignmentScore * 0.12, 0, 100)

  return {
    mode: 'demo',
    summary: {
      totalValueUsd: seed.portions.totalUsd,
      totalPnlUsd: seed.portions.pnl24hUsd,
      totalPnlPct: seed.portions.pnl24hPct,
      portfolioRiskScore: risk.portfolioRiskScore,
      holdingsCount: holdings.length,
      smartMoneyAlignment: alignment.alignmentScore,
      portfolioHealthScore: Math.round(healthScore),
      sample: true,
    },
    holdings,
    allocations: buildAllocations(holdings),
    risk,
    alignment,
    hiddenRisks: buildHiddenRisks(holdings),
    insights: buildInsights(risk, alignment, holdings),
    methodNote: 'portfolio-intelligence-v1 · demo desk',
    sample: true,
    liveNote: null,
  }
}

function emptyAllocations(): PortfolioAllocations {
  return { asset: [], sector: [], risk: [], liquidity: [] }
}

function buildLiveEmpty(): PortfolioIntelligenceBundle {
  return {
    mode: 'live',
    summary: {
      totalValueUsd: 0,
      totalPnlUsd: 0,
      totalPnlPct: 0,
      portfolioRiskScore: 0,
      holdingsCount: 0,
      smartMoneyAlignment: 0,
      portfolioHealthScore: 0,
      sample: false,
    },
    holdings: [],
    allocations: emptyAllocations(),
    risk: {
      highRiskHoldings: 0,
      mediumRiskHoldings: 0,
      lowRiskHoldings: 0,
      rugExposure: 0,
      concentrationRisk: 0,
      liquidityRisk: 0,
      portfolioRiskScore: 0,
      note: 'Connect a Solana wallet to compute live portfolio risk.',
      sample: false,
    },
    alignment: {
      alignmentScore: 0,
      sharedHoldings: [],
      sharedNarratives: [],
      whaleOverlap: 0,
      note: 'Awaiting wallet + smart-money overlap feeds.',
      sample: false,
    },
    hiddenRisks: [],
    insights: {
      healthLabel: 'Unavailable',
      strengths: [],
      risks: [],
      suggestedActions: ['Connect wallet to unlock portfolio intelligence'],
      sample: false,
    },
    methodNote: 'portfolio-intelligence-v1 · live awaiting wallet',
    sample: false,
    liveNote: 'Live mode requires a connected Solana wallet and portfolio API — no fabricated metrics.',
  }
}

export function buildPortfolioIntelligence(mode: TerminalDataMode): PortfolioIntelligenceBundle {
  if (mode === 'demo') return buildDemoBundle()
  return buildLiveEmpty()
}
