/**
 * Alpha Discovery Engine — AI-powered opportunity intelligence contracts + builders.
 * Demo: labeled sample desk. Live: empty awaiting feeds — never fabricate.
 */

import type { TerminalDataMode } from './data/types'
import { getDemoSeed } from './data/demo-seed'

export type AlphaCategoryId =
  | 'early_accumulation'
  | 'whale_entries'
  | 'liquidity_expansion'
  | 'momentum_breakouts'
  | 'undervalued'
  | 'narrative_leaders'

export type AlphaSectorId = 'AI' | 'Meme' | 'Gaming' | 'DeFi' | 'RWA' | 'Infrastructure'

export type AlphaOpportunityRow = {
  id: string
  mint: string
  symbol: string
  name: string
  category: AlphaCategoryId
  sector: AlphaSectorId
  alphaScore: number
  riskScore: number
  smartMoneyScore: number
  liquidityGrowthPct: number
  holderQuality: number
  conviction: number
  priceUsd: number
  changePct: number
  marketCapUsd: number
  sample: boolean
}

export type AlphaReasoning = {
  mint: string
  symbol: string
  alphaScore: number
  confidence: number
  evidence: string[]
  riskFactors: string[]
  opportunityDrivers: string[]
  sample: boolean
}

export type AlphaNarrativeSector = {
  id: AlphaSectorId
  liquidityFlow: number
  whaleActivity: number
  momentum: number
  narrativeStrength: number
  bias: 'inflow' | 'outflow' | 'mixed' | 'neutral'
  sample: boolean
}

export type AlphaTimelineEvent = {
  id: string
  at: string
  mint: string
  symbol: string
  title: string
  detail: string
  tone: 'accum' | 'watch' | 'dist' | 'signal'
  sample: boolean
}

export type AlphaDiscoveryBundle = {
  mode: TerminalDataMode
  categories: Array<{ id: AlphaCategoryId; label: string; count: number }>
  opportunities: AlphaOpportunityRow[]
  narratives: AlphaNarrativeSector[]
  timeline: AlphaTimelineEvent[]
  reasoningByMint: Record<string, AlphaReasoning>
  methodNote: string
  sample: boolean
}

const CATEGORY_LABELS: Record<AlphaCategoryId, string> = {
  early_accumulation: 'Early Accumulation',
  whale_entries: 'Whale Entries',
  liquidity_expansion: 'Liquidity Expansion',
  momentum_breakouts: 'Momentum Breakouts',
  undervalued: 'Undervalued Assets',
  narrative_leaders: 'Narrative Leaders',
}

const SECTORS: AlphaSectorId[] = ['AI', 'Meme', 'Gaming', 'DeFi', 'RWA', 'Infrastructure']

export type AlphaSortKey =
  | 'symbol'
  | 'alphaScore'
  | 'riskScore'
  | 'smartMoneyScore'
  | 'liquidityGrowthPct'
  | 'holderQuality'
  | 'conviction'

export function categoryLabel(id: AlphaCategoryId): string {
  return CATEGORY_LABELS[id]
}

export function formatAlphaPct(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(1)}%`
}

export function formatAlphaTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toISOString().slice(11, 19)
}

function demoOpportunities(): AlphaOpportunityRow[] {
  const seed = getDemoSeed()
  const bySym = Object.fromEntries(seed.discover.map((d) => [d.symbol, d]))

  const rows: Array<Omit<AlphaOpportunityRow, 'sample'>> = [
    {
      id: 'a1',
      mint: bySym.SOLCAT?.mint ?? 'DemoSolCat',
      symbol: 'SOLCAT',
      name: bySym.SOLCAT?.name ?? 'Sol Cat',
      category: 'early_accumulation',
      sector: 'Meme',
      alphaScore: 91,
      riskScore: 38,
      smartMoneyScore: 88,
      liquidityGrowthPct: 42.5,
      holderQuality: 74,
      conviction: 86,
      priceUsd: bySym.SOLCAT?.priceUsd ?? 0.0124,
      changePct: bySym.SOLCAT?.changePct ?? 34.1,
      marketCapUsd: bySym.SOLCAT?.marketCapUsd ?? 3_100_000,
    },
    {
      id: 'a2',
      mint: bySym.AGENTX?.mint ?? 'DemoAgentX',
      symbol: 'AGENTX',
      name: bySym.AGENTX?.name ?? 'Agent X',
      category: 'early_accumulation',
      sector: 'AI',
      alphaScore: 84,
      riskScore: 29,
      smartMoneyScore: 81,
      liquidityGrowthPct: 18.2,
      holderQuality: 82,
      conviction: 79,
      priceUsd: bySym.AGENTX?.priceUsd ?? 0.221,
      changePct: bySym.AGENTX?.changePct ?? -4.8,
      marketCapUsd: bySym.AGENTX?.marketCapUsd ?? 18_600_000,
    },
    {
      id: 'a3',
      mint: bySym.WHALE?.mint ?? 'DemoWhale',
      symbol: 'WHALE',
      name: bySym.WHALE?.name ?? 'Whale Protocol',
      category: 'whale_entries',
      sector: 'DeFi',
      alphaScore: 87,
      riskScore: 34,
      smartMoneyScore: 93,
      liquidityGrowthPct: 27.8,
      holderQuality: 86,
      conviction: 90,
      priceUsd: bySym.WHALE?.priceUsd ?? 1.24,
      changePct: bySym.WHALE?.changePct ?? 6.2,
      marketCapUsd: bySym.WHALE?.marketCapUsd ?? 48_200_000,
    },
    {
      id: 'a4',
      mint: bySym.ORBIT?.mint ?? 'DemoOrbit',
      symbol: 'ORBIT',
      name: bySym.ORBIT?.name ?? 'Orbit Mesh',
      category: 'whale_entries',
      sector: 'Infrastructure',
      alphaScore: 76,
      riskScore: 41,
      smartMoneyScore: 78,
      liquidityGrowthPct: 15.4,
      holderQuality: 71,
      conviction: 73,
      priceUsd: bySym.ORBIT?.priceUsd ?? 0.055,
      changePct: bySym.ORBIT?.changePct ?? 11.2,
      marketCapUsd: bySym.ORBIT?.marketCapUsd ?? 6_700_000,
    },
    {
      id: 'a5',
      mint: bySym.INFRA?.mint ?? 'DemoInfra',
      symbol: 'INFRA',
      name: bySym.INFRA?.name ?? 'Infra Rail',
      category: 'liquidity_expansion',
      sector: 'Infrastructure',
      alphaScore: 79,
      riskScore: 22,
      smartMoneyScore: 72,
      liquidityGrowthPct: 58.1,
      holderQuality: 88,
      conviction: 77,
      priceUsd: bySym.INFRA?.priceUsd ?? 0.88,
      changePct: bySym.INFRA?.changePct ?? 1.4,
      marketCapUsd: bySym.INFRA?.marketCapUsd ?? 55_000_000,
    },
    {
      id: 'a6',
      mint: bySym.LAUNCH?.mint ?? 'DemoLaunch',
      symbol: 'LAUNCH',
      name: bySym.LAUNCH?.name ?? 'LaunchLab Index',
      category: 'liquidity_expansion',
      sector: 'DeFi',
      alphaScore: 73,
      riskScore: 36,
      smartMoneyScore: 69,
      liquidityGrowthPct: 34.6,
      holderQuality: 70,
      conviction: 68,
      priceUsd: bySym.LAUNCH?.priceUsd ?? 0.45,
      changePct: bySym.LAUNCH?.changePct ?? 2.1,
      marketCapUsd: bySym.LAUNCH?.marketCapUsd ?? 22_000_000,
    },
    {
      id: 'a7',
      mint: bySym.RIFT?.mint ?? 'DemoRift',
      symbol: 'RIFT',
      name: bySym.RIFT?.name ?? 'Rift Gate',
      category: 'momentum_breakouts',
      sector: 'Gaming',
      alphaScore: 88,
      riskScore: 47,
      smartMoneyScore: 75,
      liquidityGrowthPct: 31.0,
      holderQuality: 63,
      conviction: 81,
      priceUsd: bySym.RIFT?.priceUsd ?? 0.0071,
      changePct: bySym.RIFT?.changePct ?? 22.0,
      marketCapUsd: bySym.RIFT?.marketCapUsd ?? 1_800_000,
    },
    {
      id: 'a8',
      mint: bySym.DOGEAI?.mint ?? 'DemoDogeAi',
      symbol: 'DOGEAI',
      name: bySym.DOGEAI?.name ?? 'Doge AI Agents',
      category: 'momentum_breakouts',
      sector: 'AI',
      alphaScore: 82,
      riskScore: 52,
      smartMoneyScore: 71,
      liquidityGrowthPct: 22.4,
      holderQuality: 58,
      conviction: 74,
      priceUsd: bySym.DOGEAI?.priceUsd ?? 0.0842,
      changePct: bySym.DOGEAI?.changePct ?? 18.4,
      marketCapUsd: bySym.DOGEAI?.marketCapUsd ?? 12_400_000,
    },
    {
      id: 'a9',
      mint: bySym.PULSE?.mint ?? 'DemoPulse',
      symbol: 'PULSE',
      name: bySym.PULSE?.name ?? 'Pulse Net',
      category: 'undervalued',
      sector: 'RWA',
      alphaScore: 71,
      riskScore: 31,
      smartMoneyScore: 64,
      liquidityGrowthPct: 8.2,
      holderQuality: 79,
      conviction: 66,
      priceUsd: bySym.PULSE?.priceUsd ?? 0.019,
      changePct: bySym.PULSE?.changePct ?? -2.3,
      marketCapUsd: bySym.PULSE?.marketCapUsd ?? 4_200_000,
    },
    {
      id: 'a10',
      mint: bySym.NEON?.mint ?? 'DemoNeon',
      symbol: 'NEON',
      name: bySym.NEON?.name ?? 'Neon Flow',
      category: 'undervalued',
      sector: 'Gaming',
      alphaScore: 68,
      riskScore: 33,
      smartMoneyScore: 61,
      liquidityGrowthPct: 11.5,
      holderQuality: 76,
      conviction: 64,
      priceUsd: bySym.NEON?.priceUsd ?? 0.14,
      changePct: bySym.NEON?.changePct ?? 5.5,
      marketCapUsd: bySym.NEON?.marketCapUsd ?? 9_100_000,
    },
    {
      id: 'a11',
      mint: bySym.PEPEAI?.mint ?? 'DemoPepeAi',
      symbol: 'PEPEAI',
      name: bySym.PEPEAI?.name ?? 'Pepe AI',
      category: 'narrative_leaders',
      sector: 'Meme',
      alphaScore: 85,
      riskScore: 55,
      smartMoneyScore: 70,
      liquidityGrowthPct: 26.8,
      holderQuality: 54,
      conviction: 78,
      priceUsd: bySym.PEPEAI?.priceUsd ?? 0.00062,
      changePct: bySym.PEPEAI?.changePct ?? 9.7,
      marketCapUsd: bySym.PEPEAI?.marketCapUsd ?? 2_400_000,
    },
    {
      id: 'a12',
      mint: bySym.NOODLE?.mint ?? 'DemoNoodle',
      symbol: 'NOODLE',
      name: bySym.NOODLE?.name ?? 'Noodle Fi',
      category: 'narrative_leaders',
      sector: 'DeFi',
      alphaScore: 62,
      riskScore: 68,
      smartMoneyScore: 48,
      liquidityGrowthPct: -18.4,
      holderQuality: 41,
      conviction: 44,
      priceUsd: bySym.NOODLE?.priceUsd ?? 0.0038,
      changePct: bySym.NOODLE?.changePct ?? -12.4,
      marketCapUsd: bySym.NOODLE?.marketCapUsd ?? 890_000,
    },
  ]

  return rows.map((r) => ({ ...r, sample: true }))
}

function demoReasoning(rows: AlphaOpportunityRow[]): Record<string, AlphaReasoning> {
  const map: Record<string, AlphaReasoning> = {}

  const templates: Record<
    string,
    Pick<AlphaReasoning, 'evidence' | 'riskFactors' | 'opportunityDrivers' | 'confidence'>
  > = {
    SOLCAT: {
      confidence: 88,
      evidence: [
        'Smart-money net +$182k / 6h across 3 tracked wallets',
        'LP depth +42% on primary Raydium pool',
        'Holder quality rising · top-20 concentration improving',
      ],
      riskFactors: [
        'Meme beta elevated vs SOL — size with tighter invalidation',
        'Short float of fresh wallets may unwind on first dip',
      ],
      opportunityDrivers: [
        'Early accumulation before broader tape recognition',
        'Narrative alignment with Solana meme rotation',
        'Liquidity expansion supports larger tickets',
      ],
    },
    AGENTX: {
      confidence: 81,
      evidence: [
        'AI sector inflow leadership over 24h',
        'Quiet accumulation · low retail volume vs smart money',
        'Holder quality score in top quartile of AI basket',
      ],
      riskFactors: [
        'Negative 24h print may mask continued desk buying',
        'Narrative crowdedness rising across AI agents',
      ],
      opportunityDrivers: [
        'Undetected early accumulation phase',
        'Cross-sector AI + infra overlap',
      ],
    },
    WHALE: {
      confidence: 90,
      evidence: [
        'MM cluster entry · +$95k tracked',
        'Smart money score peak in DeFi basket',
        'Stable LP with expanding depth',
      ],
      riskFactors: ['Higher mcap reduces asymmetric upside vs micros'],
      opportunityDrivers: [
        'Whale entry confirmation',
        'Conviction leadership within DeFi narrative',
      ],
    },
    RIFT: {
      confidence: 76,
      evidence: [
        'Momentum break of prior range with volume expansion',
        'Gaming narrative strength accelerating',
      ],
      riskFactors: [
        'Elevated risk score · thinner liquidity vs leaders',
        'Breakout failure risk if SOL weakens',
      ],
      opportunityDrivers: ['Momentum breakout + sector tailwind'],
    },
    INFRA: {
      confidence: 74,
      evidence: [
        'Liquidity growth +58% · structural expansion',
        'High holder quality · institutional-like distribution',
      ],
      riskFactors: ['Slower price response — patience required'],
      opportunityDrivers: ['Liquidity expansion as precondition for larger flows'],
    },
    PEPEAI: {
      confidence: 72,
      evidence: [
        'Narrative leader in Meme × AI crossover',
        'Social + flow correlation improving',
      ],
      riskFactors: ['High risk score · retail-heavy holder base'],
      opportunityDrivers: ['Narrative leadership with momentum confirmation'],
    },
  }

  for (const row of rows) {
    const t = templates[row.symbol] ?? {
      confidence: Math.round((row.alphaScore + row.conviction) / 2),
      evidence: [
        `Alpha ${row.alphaScore} · smart money ${row.smartMoneyScore}`,
        `Liquidity growth ${row.liquidityGrowthPct.toFixed(1)}%`,
      ],
      riskFactors: [
        row.riskScore >= 50
          ? 'Elevated risk score — position size constrained'
          : 'Risk within desk tolerance pending liquidity check',
      ],
      opportunityDrivers: [
        `${CATEGORY_LABELS[row.category]} signal`,
        `${row.sector} sector alignment`,
      ],
    }
    map[row.mint] = {
      mint: row.mint,
      symbol: row.symbol,
      alphaScore: row.alphaScore,
      confidence: t.confidence,
      evidence: t.evidence,
      riskFactors: t.riskFactors,
      opportunityDrivers: t.opportunityDrivers,
      sample: true,
    }
  }
  return map
}

function demoNarratives(): AlphaNarrativeSector[] {
  const data: Array<Omit<AlphaNarrativeSector, 'sample'>> = [
    {
      id: 'AI',
      liquidityFlow: 78,
      whaleActivity: 72,
      momentum: 81,
      narrativeStrength: 86,
      bias: 'inflow',
    },
    {
      id: 'Meme',
      liquidityFlow: 84,
      whaleActivity: 79,
      momentum: 88,
      narrativeStrength: 82,
      bias: 'inflow',
    },
    {
      id: 'Gaming',
      liquidityFlow: 61,
      whaleActivity: 55,
      momentum: 74,
      narrativeStrength: 68,
      bias: 'mixed',
    },
    {
      id: 'DeFi',
      liquidityFlow: 69,
      whaleActivity: 81,
      momentum: 58,
      narrativeStrength: 64,
      bias: 'inflow',
    },
    {
      id: 'RWA',
      liquidityFlow: 44,
      whaleActivity: 38,
      momentum: 41,
      narrativeStrength: 52,
      bias: 'neutral',
    },
    {
      id: 'Infrastructure',
      liquidityFlow: 73,
      whaleActivity: 66,
      momentum: 54,
      narrativeStrength: 71,
      bias: 'inflow',
    },
  ]
  return data.map((d) => ({ ...d, sample: true }))
}

function demoTimeline(now: number, rows: AlphaOpportunityRow[]): AlphaTimelineEvent[] {
  const bySym = Object.fromEntries(rows.map((r) => [r.symbol, r]))
  const events: AlphaTimelineEvent[] = [
    {
      id: 't1',
      at: new Date(now - 18 * 60_000).toISOString(),
      mint: bySym.SOLCAT!.mint,
      symbol: 'SOLCAT',
      title: 'Smart money accumulation detected',
      detail: 'Net +$182k · 3 wallets · early accumulation flag raised',
      tone: 'accum',
      sample: true,
    },
    {
      id: 't2',
      at: new Date(now - 42 * 60_000).toISOString(),
      mint: bySym.SOLCAT!.mint,
      symbol: 'SOLCAT',
      title: 'LP depth expansion',
      detail: 'Primary pool liquidity +21% · supports larger tickets',
      tone: 'signal',
      sample: true,
    },
    {
      id: 't3',
      at: new Date(now - 95 * 60_000).toISOString(),
      mint: bySym.WHALE!.mint,
      symbol: 'WHALE',
      title: 'Whale entry cluster',
      detail: 'MM cluster opened WHALE · smart money score spike',
      tone: 'accum',
      sample: true,
    },
    {
      id: 't4',
      at: new Date(now - 130 * 60_000).toISOString(),
      mint: bySym.RIFT!.mint,
      symbol: 'RIFT',
      title: 'Momentum range break',
      detail: 'Price cleared prior resistance with volume confirmation',
      tone: 'signal',
      sample: true,
    },
    {
      id: 't5',
      at: new Date(now - 180 * 60_000).toISOString(),
      mint: bySym.INFRA!.mint,
      symbol: 'INFRA',
      title: 'Liquidity expansion phase',
      detail: 'Structural LP growth +58% · holder quality stable',
      tone: 'accum',
      sample: true,
    },
    {
      id: 't6',
      at: new Date(now - 240 * 60_000).toISOString(),
      mint: bySym.PEPEAI!.mint,
      symbol: 'PEPEAI',
      title: 'Narrative leadership print',
      detail: 'Meme × AI crossover strength leading sector basket',
      tone: 'watch',
      sample: true,
    },
    {
      id: 't7',
      at: new Date(now - 310 * 60_000).toISOString(),
      mint: bySym.NOODLE!.mint,
      symbol: 'NOODLE',
      title: 'Distribution watch',
      detail: 'Smart money outflow · liquidity thinning — downgraded',
      tone: 'dist',
      sample: true,
    },
    {
      id: 't8',
      at: new Date(now - 360 * 60_000).toISOString(),
      mint: bySym.AGENTX!.mint,
      symbol: 'AGENTX',
      title: 'Quiet accumulation window',
      detail: 'Desk buying vs low retail — alpha window open',
      tone: 'accum',
      sample: true,
    },
  ]
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

function buildDemoBundle(): AlphaDiscoveryBundle {
  const now = Date.now()
  const opportunities = demoOpportunities()
  const categories = (Object.keys(CATEGORY_LABELS) as AlphaCategoryId[]).map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    count: opportunities.filter((o) => o.category === id).length,
  }))

  return {
    mode: 'demo',
    categories,
    opportunities,
    narratives: demoNarratives(),
    timeline: demoTimeline(now, opportunities),
    reasoningByMint: demoReasoning(opportunities),
    methodNote: 'alpha-discovery-v1 · demo desk',
    sample: true,
  }
}

function buildLiveEmpty(): AlphaDiscoveryBundle {
  const categories = (Object.keys(CATEGORY_LABELS) as AlphaCategoryId[]).map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    count: 0,
  }))
  return {
    mode: 'live',
    categories,
    opportunities: [],
    narratives: SECTORS.map((id) => ({
      id,
      liquidityFlow: 0,
      whaleActivity: 0,
      momentum: 0,
      narrativeStrength: 0,
      bias: 'neutral' as const,
      sample: false,
    })),
    timeline: [],
    reasoningByMint: {},
    methodNote: 'alpha-discovery-v1 · live awaiting feeds',
    sample: false,
  }
}

export function buildAlphaDiscovery(mode: TerminalDataMode): AlphaDiscoveryBundle {
  if (mode === 'demo') return buildDemoBundle()
  return buildLiveEmpty()
}

export function sortAlphaRows(
  rows: AlphaOpportunityRow[],
  key: AlphaSortKey,
  dir: 'asc' | 'desc',
): AlphaOpportunityRow[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * mul
    }
    return ((av as number) - (bv as number)) * mul
  })
}
