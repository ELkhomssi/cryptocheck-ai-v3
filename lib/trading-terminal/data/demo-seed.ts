/**
 * DEMO_SEED — deterministic, internally-consistent demo dataset for the terminal.
 * Labeled demo only. Never present as live market state without the DEMO DATA badge.
 * Keep all demo numbers here; components must not hardcode panel values.
 */

import type { DemoSeed, DiscoverToken, IntelEvent } from './types'

export const DEMO_SEED_TAG = 'DEMO_SEED' as const
export const DEMO_SEED_VERSION = 1

const SEED = 20260721

function mulberry32(a: number) {
  return function next() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function spark(rng: () => number, n = 24, base = 50): number[] {
  const out: number[] = []
  let v = base
  for (let i = 0; i < n; i++) {
    v = Math.max(8, Math.min(92, v + (rng() - 0.48) * 8))
    out.push(Number(v.toFixed(2)))
  }
  return out
}

function candles(
  rng: () => number,
  start: number,
  points: number,
  startPrice: number,
): Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> {
  const out = []
  let price = startPrice
  const step = 5 * 60 * 1000
  for (let i = 0; i < points; i++) {
    const o = price
    const drift = (rng() - 0.45) * startPrice * 0.02
    const c = Math.max(0.000001, o + drift)
    const h = Math.max(o, c) * (1 + rng() * 0.01)
    const l = Math.min(o, c) * (1 - rng() * 0.01)
    const v = 1_000 + rng() * 40_000
    out.push({ t: start + i * step, o, h, l, c, v })
    price = c
  }
  return out
}

/** Stable fake mints — look like base58, used only in DEMO_SEED. */
const MINTS = {
  WHALE: 'DemoWhale11111111111111111111111111111111',
  DOGEAI: 'DemoDogeAi2222222222222222222222222222222',
  NOODLE: 'DemoNoodle333333333333333333333333333333',
  AGENTX: 'DemoAgentX444444444444444444444444444444',
  SOLCAT: 'DemoSolCat555555555555555555555555555555',
  PEPEAI: 'DemoPepeAi666666666666666666666666666666',
  LAUNCH: 'DemoLaunch777777777777777777777777777777',
  INFRA: 'DemoInfra8888888888888888888888888888888',
  ORBIT: 'DemoOrbit9999999999999999999999999999999',
  PULSE: 'DemoPulseAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  NEON: 'DemoNeonBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  RIFT: 'DemoRiftCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
} as const

const FOCUS = MINTS.SOLCAT

export function buildDemoSeed(now = Date.now()): DemoSeed {
  const rng = mulberry32(SEED)
  const discover: DiscoverToken[] = [
    {
      mint: MINTS.DOGEAI,
      symbol: 'DOGEAI',
      name: 'Doge AI Agents',
      priceUsd: 0.0842,
      changePct: 18.4,
      marketCapUsd: 12_400_000,
      views: 18420,
      badge: 'HOT',
    },
    {
      mint: MINTS.WHALE,
      symbol: 'WHALE',
      name: 'Whale Protocol',
      priceUsd: 1.24,
      changePct: 6.2,
      marketCapUsd: 48_200_000,
      views: 9200,
      badge: 'TRENDING',
    },
    {
      mint: MINTS.SOLCAT,
      symbol: 'SOLCAT',
      name: 'Sol Cat',
      priceUsd: 0.0124,
      changePct: 34.1,
      marketCapUsd: 3_100_000,
      views: 22100,
      badge: 'HOT',
    },
    {
      mint: MINTS.AGENTX,
      symbol: 'AGENTX',
      name: 'Agent X',
      priceUsd: 0.221,
      changePct: -4.8,
      marketCapUsd: 18_600_000,
      views: 6400,
      badge: 'SAFE',
    },
    {
      mint: MINTS.NOODLE,
      symbol: 'NOODLE',
      name: 'Noodle Fi',
      priceUsd: 0.0038,
      changePct: -12.4,
      marketCapUsd: 890_000,
      views: 4100,
      badge: 'RISK',
    },
    {
      mint: MINTS.PEPEAI,
      symbol: 'PEPEAI',
      name: 'Pepe AI',
      priceUsd: 0.00062,
      changePct: 9.7,
      marketCapUsd: 2_400_000,
      views: 11200,
      badge: 'NEW',
    },
    {
      mint: MINTS.LAUNCH,
      symbol: 'LAUNCH',
      name: 'LaunchLab Index',
      priceUsd: 0.45,
      changePct: 2.1,
      marketCapUsd: 22_000_000,
      views: 5300,
      badge: 'TRENDING',
    },
    {
      mint: MINTS.INFRA,
      symbol: 'INFRA',
      name: 'Infra Rail',
      priceUsd: 0.88,
      changePct: 1.4,
      marketCapUsd: 55_000_000,
      views: 3100,
      badge: 'SAFE',
    },
    {
      mint: MINTS.ORBIT,
      symbol: 'ORBIT',
      name: 'Orbit Mesh',
      priceUsd: 0.055,
      changePct: 11.2,
      marketCapUsd: 6_700_000,
      views: 7800,
      badge: 'NEW',
    },
    {
      mint: MINTS.PULSE,
      symbol: 'PULSE',
      name: 'Pulse Net',
      priceUsd: 0.019,
      changePct: -2.3,
      marketCapUsd: 4_200_000,
      views: 2900,
      badge: null,
    },
    {
      mint: MINTS.NEON,
      symbol: 'NEON',
      name: 'Neon Flow',
      priceUsd: 0.14,
      changePct: 5.5,
      marketCapUsd: 9_100_000,
      views: 4500,
      badge: 'TRENDING',
    },
    {
      mint: MINTS.RIFT,
      symbol: 'RIFT',
      name: 'Rift Gate',
      priceUsd: 0.0071,
      changePct: 22.0,
      marketCapUsd: 1_800_000,
      views: 9900,
      badge: 'HOT',
    },
  ]

  const doge = discover.find((d) => d.mint === MINTS.DOGEAI)!
  const solcat = discover.find((d) => d.mint === MINTS.SOLCAT)!
  const focusTok = discover.find((d) => d.mint === FOCUS)!
  const chartStart = now - 120 * 5 * 60 * 1000

  const chartOrder = [
    MINTS.SOLCAT,
    MINTS.WHALE,
    MINTS.AGENTX,
    MINTS.PEPEAI,
    MINTS.NOODLE,
    MINTS.DOGEAI,
  ]
  const charts = chartOrder.map((mint) => {
    const t = discover.find((d) => d.mint === mint)!
    const c = candles(rng, chartStart, 120, t.priceUsd)
    const last = c[c.length - 1]!
    const first = c[0]!
    return {
      mint: t.mint,
      symbol: t.symbol,
      timeframe: '5m',
      lastPrice: last.c,
      changePct: ((last.c - first.o) / first.o) * 100,
      candles: c,
    }
  })

  const intel: IntelEvent[] = [
    {
      id: 'demo-intel-1',
      kind: 'smart_money_buy',
      headline: 'Smart money bought SOLCAT',
      detail: `+$${182_000} net across 3 tracked wallets`,
      mint: MINTS.SOLCAT,
      symbol: 'SOLCAT',
      at: new Date(now - 2 * 60_000).toISOString(),
      ref: 'demo:tx:sm-buy-1',
    },
    {
      id: 'demo-intel-2',
      kind: 'new_pool',
      headline: 'Liquidity pool created SOLCAT',
      detail: 'SOLCAT/SOL pool seeded · $240k initial LP',
      mint: MINTS.SOLCAT,
      symbol: 'SOLCAT',
      at: new Date(now - 8 * 60_000).toISOString(),
      ref: 'demo:tx:pool-1',
    },
    {
      id: 'demo-intel-3',
      kind: 'whale_accumulation',
      headline: 'Whale accumulation WHALE',
      detail: 'Top wallet +2.1% supply in 1h',
      mint: MINTS.WHALE,
      symbol: 'WHALE',
      at: new Date(now - 14 * 60_000).toISOString(),
      ref: 'demo:tx:whale-1',
    },
    {
      id: 'demo-intel-4',
      kind: 'large_buy',
      headline: 'Large buy AGENTX',
      detail: '+$94k single wallet',
      mint: MINTS.AGENTX,
      symbol: 'AGENTX',
      at: new Date(now - 4 * 60_000).toISOString(),
      ref: 'demo:tx:buy-1',
    },
    {
      id: 'demo-intel-5',
      kind: 'risk_score_change',
      headline: 'Risk score changed NOODLE',
      detail: 'Risk 48 → 71 · liquidity thinning',
      mint: MINTS.NOODLE,
      symbol: 'NOODLE',
      at: new Date(now - 18 * 60_000).toISOString(),
      ref: 'demo:scan:noodle',
    },
    {
      id: 'demo-intel-6',
      kind: 'smart_money_sell',
      headline: 'Smart money exiting NOODLE',
      detail: '−$41k net tracked outflow',
      mint: MINTS.NOODLE,
      symbol: 'NOODLE',
      at: new Date(now - 40 * 60_000).toISOString(),
      ref: 'demo:tx:sm-sell-1',
    },
  ]

  return {
    tag: DEMO_SEED_TAG,
    seed: SEED,
    focusMint: FOCUS,
    focusSymbol: focusTok.symbol,
    solPriceUsd: 148.62,
    market: {
      stats: [
        {
          id: 'market_cap',
          label: 'MARKET CAP',
          value: '$2.41T',
          changePct: '+1.2%',
          tone: 'pos',
          sparkline: spark(rng, 24, 60),
        },
        {
          id: 'volume_24h',
          label: '24H VOLUME',
          value: '$98.4B',
          changePct: '-3.1%',
          tone: 'neg',
          sparkline: spark(rng, 24, 55),
        },
        {
          id: 'btc_dominance',
          label: 'BTC DOMINANCE',
          value: '54.2%',
          changePct: '+0.4%',
          tone: 'pos',
          sparkline: spark(rng, 24, 52),
        },
        {
          id: 'sol_price',
          label: 'SOL PRICE',
          value: '$148.62',
          changePct: '+2.8%',
          tone: 'pos',
          sparkline: spark(rng, 24, 58),
        },
        {
          id: 'active_wallets',
          label: 'ACTIVE WALLETS',
          value: '1.84M',
          changePct: '+5.6%',
          tone: 'pos',
          sparkline: spark(rng, 24, 48),
        },
      ],
      fearGreed: { score: 72, label: 'Greed' },
      health: 'ok',
    },
    discover,
    charts,
    coach: {
      mint: solcat.mint,
      symbol: solcat.symbol,
      name: solcat.name,
      verdict: 'SAFE',
      riskScore: 28,
      safetyScore: 82,
      confidencePct: 92,
      evidenceCoveragePct: 85,
      why: [
        { text: 'Smart money accumulation +$182K (24h)', direction: 'up', sourceField: 'smart_money_flow' },
        { text: 'Liquidity growth +21% in 24h', direction: 'up', sourceField: 'lp_delta' },
        { text: 'Holder growth +14% in 24h', direction: 'up', sourceField: 'holder_growth' },
        { text: 'Insider activity: none detected', direction: 'up', sourceField: 'insider' },
        { text: 'Low deployer concentration (8.3%)', direction: 'up', sourceField: 'dev_concentration' },
      ],
      action: 'BUY SOLCAT — high-conviction SAFE setup with smart-money + LP confirmation.',
      recommended: {
        side: 'BUY',
        symbol: solcat.symbol,
        mint: solcat.mint,
        name: solcat.name,
        verdict: 'SAFE',
        convictionScore: 92,
        riskScore: 28,
        confidencePct: 89,
        evidenceCoveragePct: 84,
        headline: 'BUY SOLCAT',
      },
      tradePlan: {
        entryZone: 'Near mark $0.0124 (zone $0.0118–$0.0128)',
        riskLevel: 'LOW',
        invalidation: 'Abort if risk score ≥ 55 or LP −15% in 2h',
        takeProfits: ['TP1 +18%', 'TP2 +35%'],
        suggestedSize: '≤ 2.5% of book',
      },
      portfolioHealth: {
        score: 71,
        issues: ['Memecoin sleeve elevated', 'NOODLE liquidity deteriorating'],
      },
      riskExposure: {
        categories: [
          { name: 'Memecoins', pct: 37 },
          { name: 'SOL', pct: 32 },
          { name: 'AI Agents', pct: 18 },
          { name: 'Others', pct: 13 },
        ],
        flags: ['Reduce NOODLE before scaling SOLCAT'],
      },
      riskAnalysis: {
        concentration: 'MEDIUM',
        liquidity: 'LOW',
        correlation: 'MEDIUM',
        volatility: 'MEDIUM',
        smartMoney: 'LOW',
      },
      opportunities: [
        {
          symbol: 'SOLCAT',
          reason: 'Smart money +$182k · LP +21%',
          conviction: 92,
          riskLevel: 'MEDIUM',
        },
        {
          symbol: 'AGENTX',
          reason: 'Accumulation · holder growth',
          conviction: 78,
          riskLevel: 'LOW',
        },
        {
          symbol: 'WHALE',
          reason: 'Strong inflow · new capital',
          conviction: 75,
          riskLevel: 'MEDIUM',
        },
      ],
      threats: [
        { symbol: 'NOODLE', reason: 'LP −38% in 2h · smart-money exiting', severity: 'HIGH' },
      ],
      smartMoney: {
        netFlowUsd: 182_000,
        notable: ['SOLCAT +$182k (3 wallets)', 'NOODLE −$41k (2 wallets)'],
      },
      capitalAllocation: 'Size SOLCAT ≤2.5% of book after reducing NOODLE liquidity risk.',
      similar: {
        count: 12,
        avgOutcomePct: 18.4,
        winRatePct: 61,
        avgHoldDays: 4.2,
      },
      actionQueue: [
        {
          type: 'BUY',
          symbol: 'SOLCAT',
          reason: 'High conviction — smart money + LP growth',
          priority: 1,
        },
        {
          type: 'REDUCE',
          symbol: 'NOODLE',
          reason: 'Liquidity risk — LP deterioration',
          priority: 2,
        },
        {
          type: 'MONITOR',
          symbol: 'AGENTX',
          reason: 'Watch accumulation',
          priority: 3,
        },
        {
          type: 'WATCH',
          symbol: 'PEPEAI',
          reason: 'Building momentum',
          priority: 4,
        },
      ],
      weekly: {
        weekOf: new Date(now).toISOString().slice(0, 10),
        topNarrative: 'AI Agents',
        smartMoneyRotation: 'Into LaunchLab tokens',
        convictionSector: 'Infrastructure',
        biggestRisk: 'Liquidity fragmentation',
        summary: 'Risk appetite increasing across AI memecoins.',
      },
    },
    positions: [
      {
        mint: MINTS.DOGEAI,
        symbol: 'DOGEAI',
        size: 8200,
        entryUsd: 0.071,
        priceUsd: doge.priceUsd,
        pnlUsd: 108.24,
        pnlPct: 18.6,
        change24hPct: 18.4,
        valueUsd: 690.44,
        verdict: 'CAUTION',
        riskScore: 42,
      },
      {
        mint: MINTS.WHALE,
        symbol: 'WHALE',
        size: 410,
        entryUsd: 1.05,
        priceUsd: 1.24,
        pnlUsd: 77.9,
        pnlPct: 18.1,
        change24hPct: 6.2,
        valueUsd: 508.4,
        verdict: 'SAFE',
        riskScore: 28,
      },
      {
        mint: MINTS.NOODLE,
        symbol: 'NOODLE',
        size: 95_000,
        entryUsd: 0.0045,
        priceUsd: 0.0038,
        pnlUsd: -66.5,
        pnlPct: -15.6,
        change24hPct: -12.4,
        valueUsd: 361,
        verdict: 'DANGER',
        riskScore: 67,
      },
      {
        mint: MINTS.AGENTX,
        symbol: 'AGENTX',
        size: 1200,
        entryUsd: 0.19,
        priceUsd: 0.221,
        pnlUsd: 37.2,
        pnlPct: 16.3,
        change24hPct: -4.8,
        valueUsd: 265.2,
        verdict: 'SAFE',
        riskScore: 31,
      },
    ],
    portions: {
      totalUsd: 24_560.23,
      pnl24hUsd: 1_248.41,
      pnl24hPct: 5.36,
      legend: [
        { name: 'SOL', pct: 32, valueUsd: 7_859 },
        { name: 'USDC', pct: 18, valueUsd: 4_421 },
        { name: 'Memecoins', pct: 37, valueUsd: 9_087 },
        { name: 'Others', pct: 13, valueUsd: 3_193 },
      ],
    },
    trades: [
      {
        id: 'demo-tr-1',
        mint: MINTS.DOGEAI,
        symbol: 'DOGEAI',
        side: 'buy',
        priceUsd: 0.071,
        at: new Date(now - 3_600_000).toISOString(),
        coachTag: 'CAUTION',
      },
      {
        id: 'demo-tr-2',
        mint: MINTS.WHALE,
        symbol: 'WHALE',
        side: 'buy',
        priceUsd: 1.05,
        at: new Date(now - 7_200_000).toISOString(),
        coachTag: 'SAFE',
      },
      {
        id: 'demo-tr-3',
        mint: MINTS.AGENTX,
        symbol: 'AGENTX',
        side: 'sell',
        priceUsd: 0.24,
        at: new Date(now - 14_400_000).toISOString(),
        coachTag: 'TAKE PROFIT',
      },
      {
        id: 'demo-tr-4',
        mint: MINTS.NOODLE,
        symbol: 'NOODLE',
        side: 'buy',
        priceUsd: 0.0045,
        at: new Date(now - 28_800_000).toISOString(),
        coachTag: 'HIGH RISK',
      },
    ],
    intel,
    watchlists: [
      { id: 'main', name: 'Main Watchlist', count: 24 },
      { id: 'trending', name: 'Trending', count: 12 },
      { id: 'long', name: 'Long Term', count: 8 },
      { id: 'sniper', name: 'Sniper Targets', count: 6 },
    ],
    tradeMarks: {
      marked: 12,
      winRatePct: 58.3,
      avgDeltaPct: 24.7,
      bestPct: 98.9,
      worstPct: -22.1,
    },
    sniper: {
      armed: false,
      target: 'WHALE/SOL',
      rescanInSec: 24,
      riskMonitor: 'LOW',
      sparkline: spark(rng, 24, 62),
    },
  }
}

/** Singleton seed for a session (deterministic). */
let cached: DemoSeed | null = null
export function getDemoSeed(): DemoSeed {
  if (!cached) cached = buildDemoSeed()
  return cached
}

export function resetDemoSeedCache(): void {
  cached = null
}
