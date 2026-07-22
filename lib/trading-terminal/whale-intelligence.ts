/**
 * Whale Intelligence — Smart Money Intelligence System contracts + demo/live builders.
 * Demo: labeled sample desk. Live: empty awaiting feeds — never fabricate.
 */

import type { TerminalDataMode } from './data/types'
import { getDemoSeed } from './data/demo-seed'

export type WhaleCohortId =
  | 'top_buyers'
  | 'smart_money'
  | 'early_entry'
  | 'insider_pattern'
  | 'fresh_accumulation'

export type WhaleLastAction = 'BUY' | 'SELL' | 'HOLD' | 'TRANSFER' | 'LP_ADD' | 'LP_REMOVE'

export type WhaleWalletRow = {
  id: string
  address: string
  label: string
  cohort: WhaleCohortId
  winRatePct: number
  realizedPnlUsd: number
  unrealizedPnlUsd: number
  avgHoldHours: number
  lastAction: WhaleLastAction
  lastActionAt: string
  confidenceScore: number
  focusMint: string | null
  focusSymbol: string | null
  sample: boolean
}

export type WhaleFlowNodeKind = 'wallet' | 'token' | 'dex' | 'pool'

export type WhaleFlowNode = {
  id: string
  kind: WhaleFlowNodeKind
  label: string
  sublabel?: string
  x: number
  y: number
  tone: 'accum' | 'watch' | 'dist' | 'neutral'
  meta?: Record<string, string | number>
  sample: boolean
}

export type WhaleFlowEdge = {
  id: string
  from: string
  to: string
  label?: string
  tone: 'accum' | 'watch' | 'dist' | 'neutral'
  weight: number
  sample: boolean
}

export type WhaleFeedEventType =
  | 'BUY'
  | 'SELL'
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'INSIDER_SIGNAL'
  | 'LIQUIDITY_MOVE'

export type WhaleFeedTone = 'accum' | 'watch' | 'dist'

export type WhaleFeedEvent = {
  id: string
  at: string
  type: WhaleFeedEventType
  tone: WhaleFeedTone
  walletLabel: string
  walletAddress: string
  tokenSymbol: string
  tokenMint: string | null
  description: string
  usdNotional: number | null
  sample: boolean
}

export type WhaleConsensusMetrics = {
  smartMoneyScore: number
  whaleConviction: number
  insiderRisk: number
  distributionProbability: number
  marketInfluence: number
  confidence: number
  bias: 'accumulation' | 'distribution' | 'mixed' | 'neutral'
  summary: string
  sample: boolean
}

export type WhaleIntelligenceBundle = {
  mode: TerminalDataMode
  cohorts: Array<{ id: WhaleCohortId; label: string; count: number }>
  wallets: WhaleWalletRow[]
  nodes: WhaleFlowNode[]
  edges: WhaleFlowEdge[]
  feed: WhaleFeedEvent[]
  consensus: WhaleConsensusMetrics
  methodNote: string
  sample: boolean
}

const COHORT_LABELS: Record<WhaleCohortId, string> = {
  top_buyers: 'Top Buyers',
  smart_money: 'Smart Money Wallets',
  early_entry: 'Early Entry Wallets',
  insider_pattern: 'Insider Pattern Wallets',
  fresh_accumulation: 'Fresh Wallet Accumulation',
}

function truncAddr(a: string): string {
  return a.length < 10 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`
}

function demoWallets(now: number): WhaleWalletRow[] {
  const seed = getDemoSeed()
  const solcat = seed.focusMint
  const noodle = seed.discover.find((d) => d.symbol === 'NOODLE')?.mint ?? null
  const whale = seed.discover.find((d) => d.symbol === 'WHALE')?.mint ?? null
  const agentx = seed.discover.find((d) => d.symbol === 'AGENTX')?.mint ?? null

  const rows: Array<Omit<WhaleWalletRow, 'sample'>> = [
    {
      id: 'w1',
      address: 'SM7xKp9aR2mN4vQ8wY1cL6bH3dF5eT0uJ9sA2',
      label: 'Alpha Desk · A1',
      cohort: 'top_buyers',
      winRatePct: 68.4,
      realizedPnlUsd: 412_000,
      unrealizedPnlUsd: 86_400,
      avgHoldHours: 38,
      lastAction: 'BUY',
      lastActionAt: new Date(now - 3 * 60_000).toISOString(),
      confidenceScore: 91,
      focusMint: solcat,
      focusSymbol: 'SOLCAT',
    },
    {
      id: 'w2',
      address: 'SM2bN8cR5tY1vL4wX7zA0mK3pQ6sD9fH2eU5',
      label: 'Vault · North',
      cohort: 'top_buyers',
      winRatePct: 61.2,
      realizedPnlUsd: 228_000,
      unrealizedPnlUsd: 41_200,
      avgHoldHours: 52,
      lastAction: 'BUY',
      lastActionAt: new Date(now - 11 * 60_000).toISOString(),
      confidenceScore: 84,
      focusMint: solcat,
      focusSymbol: 'SOLCAT',
    },
    {
      id: 'w3',
      address: 'SM9qW3eR7tY2uI5oP8aS1dF4gH6jK0lZ3xC7',
      label: 'MM Cluster · 7',
      cohort: 'smart_money',
      winRatePct: 72.1,
      realizedPnlUsd: 890_000,
      unrealizedPnlUsd: 124_000,
      avgHoldHours: 26,
      lastAction: 'HOLD',
      lastActionAt: new Date(now - 28 * 60_000).toISOString(),
      confidenceScore: 88,
      focusMint: whale,
      focusSymbol: 'WHALE',
    },
    {
      id: 'w4',
      address: 'SM4hJ6kL9mN2bV5cX8zA1sD3fG7pQ0wE4rT6',
      label: 'Fund Relay · K',
      cohort: 'smart_money',
      winRatePct: 64.8,
      realizedPnlUsd: 510_000,
      unrealizedPnlUsd: -22_400,
      avgHoldHours: 44,
      lastAction: 'SELL',
      lastActionAt: new Date(now - 41 * 60_000).toISOString(),
      confidenceScore: 79,
      focusMint: noodle,
      focusSymbol: 'NOODLE',
    },
    {
      id: 'w5',
      address: 'EE1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2',
      label: 'Early · Sniper-02',
      cohort: 'early_entry',
      winRatePct: 58.0,
      realizedPnlUsd: 96_000,
      unrealizedPnlUsd: 54_800,
      avgHoldHours: 14,
      lastAction: 'BUY',
      lastActionAt: new Date(now - 6 * 60_000).toISOString(),
      confidenceScore: 76,
      focusMint: agentx,
      focusSymbol: 'AGENTX',
    },
    {
      id: 'w6',
      address: 'EE8xY7wV6uT5sR4qP3oN2mL1kJ0iH9gF8eD7',
      label: 'Early · Block-0',
      cohort: 'early_entry',
      winRatePct: 55.4,
      realizedPnlUsd: 71_200,
      unrealizedPnlUsd: 18_600,
      avgHoldHours: 9,
      lastAction: 'BUY',
      lastActionAt: new Date(now - 19 * 60_000).toISOString(),
      confidenceScore: 71,
      focusMint: solcat,
      focusSymbol: 'SOLCAT',
    },
    {
      id: 'w7',
      address: 'IN5cV4bN3mX2zL1kJ0hG9fD8sA7pO6iU5yT4',
      label: 'Deployer Prox · Δ',
      cohort: 'insider_pattern',
      winRatePct: 49.2,
      realizedPnlUsd: 180_000,
      unrealizedPnlUsd: -64_000,
      avgHoldHours: 6,
      lastAction: 'TRANSFER',
      lastActionAt: new Date(now - 52 * 60_000).toISOString(),
      confidenceScore: 62,
      focusMint: noodle,
      focusSymbol: 'NOODLE',
    },
    {
      id: 'w8',
      address: 'IN2qW1eR0tY9uI8oP7aS6dF5gH4jK3lZ2xC1',
      label: 'Cluster Link · β',
      cohort: 'insider_pattern',
      winRatePct: 44.0,
      realizedPnlUsd: 38_000,
      unrealizedPnlUsd: -12_800,
      avgHoldHours: 4,
      lastAction: 'LP_REMOVE',
      lastActionAt: new Date(now - 67 * 60_000).toISOString(),
      confidenceScore: 58,
      focusMint: noodle,
      focusSymbol: 'NOODLE',
    },
    {
      id: 'w9',
      address: 'FW3mK2jH1gF0dS9aP8oI7uY6tR5eW4qE3nB2',
      label: 'Fresh · 14h',
      cohort: 'fresh_accumulation',
      winRatePct: 0,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 22_400,
      avgHoldHours: 8,
      lastAction: 'BUY',
      lastActionAt: new Date(now - 8 * 60_000).toISOString(),
      confidenceScore: 66,
      focusMint: solcat,
      focusSymbol: 'SOLCAT',
    },
    {
      id: 'w10',
      address: 'FW9zX8cV7bN6mL5kJ4hG3fD2sA1pO0iU9yT8',
      label: 'Fresh · 6h',
      cohort: 'fresh_accumulation',
      winRatePct: 0,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 9_800,
      avgHoldHours: 3,
      lastAction: 'BUY',
      lastActionAt: new Date(now - 14 * 60_000).toISOString(),
      confidenceScore: 61,
      focusMint: agentx,
      focusSymbol: 'AGENTX',
    },
  ]

  return rows.map((r) => ({ ...r, sample: true }))
}

function demoGraph(wallets: WhaleWalletRow[]): { nodes: WhaleFlowNode[]; edges: WhaleFlowEdge[] } {
  const nodes: WhaleFlowNode[] = [
    {
      id: 'dex:raydium',
      kind: 'dex',
      label: 'Raydium',
      sublabel: 'DEX',
      x: 520,
      y: 210,
      tone: 'neutral',
      sample: true,
    },
    {
      id: 'pool:solcat',
      kind: 'pool',
      label: 'SOLCAT/SOL',
      sublabel: 'LP',
      x: 720,
      y: 140,
      tone: 'accum',
      meta: { depthUsd: 240_000 },
      sample: true,
    },
    {
      id: 'pool:noodle',
      kind: 'pool',
      label: 'NOODLE/SOL',
      sublabel: 'LP',
      x: 720,
      y: 300,
      tone: 'dist',
      meta: { depthUsd: 62_000 },
      sample: true,
    },
    {
      id: 'tok:solcat',
      kind: 'token',
      label: 'SOLCAT',
      sublabel: 'Token',
      x: 340,
      y: 120,
      tone: 'accum',
      sample: true,
    },
    {
      id: 'tok:noodle',
      kind: 'token',
      label: 'NOODLE',
      sublabel: 'Token',
      x: 340,
      y: 280,
      tone: 'dist',
      sample: true,
    },
    {
      id: 'tok:whale',
      kind: 'token',
      label: 'WHALE',
      sublabel: 'Token',
      x: 340,
      y: 200,
      tone: 'watch',
      sample: true,
    },
  ]

  const walletNodes = wallets.slice(0, 6).map((w, i) => {
    const tone: WhaleFlowNode['tone'] =
      w.lastAction === 'SELL' || w.lastAction === 'LP_REMOVE'
        ? 'dist'
        : w.cohort === 'insider_pattern'
          ? 'watch'
          : 'accum'
    return {
      id: `wal:${w.id}`,
      kind: 'wallet' as const,
      label: w.label,
      sublabel: truncAddr(w.address),
      x: 80,
      y: 60 + i * 58,
      tone,
      meta: { confidence: w.confidenceScore, winRate: w.winRatePct },
      sample: true,
    }
  })

  nodes.push(...walletNodes)

  const edges: WhaleFlowEdge[] = [
    {
      id: 'e1',
      from: 'wal:w1',
      to: 'tok:solcat',
      label: '+$182k',
      tone: 'accum',
      weight: 3,
      sample: true,
    },
    {
      id: 'e2',
      from: 'wal:w2',
      to: 'tok:solcat',
      label: '+$74k',
      tone: 'accum',
      weight: 2,
      sample: true,
    },
    {
      id: 'e3',
      from: 'tok:solcat',
      to: 'dex:raydium',
      label: 'swap',
      tone: 'accum',
      weight: 2,
      sample: true,
    },
    {
      id: 'e4',
      from: 'dex:raydium',
      to: 'pool:solcat',
      label: 'LP +21%',
      tone: 'accum',
      weight: 3,
      sample: true,
    },
    {
      id: 'e5',
      from: 'wal:w4',
      to: 'tok:noodle',
      label: '−$41k',
      tone: 'dist',
      weight: 2,
      sample: true,
    },
    {
      id: 'e6',
      from: 'tok:noodle',
      to: 'dex:raydium',
      label: 'exit',
      tone: 'dist',
      weight: 2,
      sample: true,
    },
    {
      id: 'e7',
      from: 'dex:raydium',
      to: 'pool:noodle',
      label: 'LP −38%',
      tone: 'dist',
      weight: 3,
      sample: true,
    },
    {
      id: 'e8',
      from: 'wal:w3',
      to: 'tok:whale',
      label: '+$95k',
      tone: 'watch',
      weight: 2,
      sample: true,
    },
    {
      id: 'e9',
      from: 'wal:w7',
      to: 'tok:noodle',
      label: 'insider',
      tone: 'watch',
      weight: 1,
      sample: true,
    },
    {
      id: 'e10',
      from: 'wal:w9',
      to: 'tok:solcat',
      label: 'fresh',
      tone: 'accum',
      weight: 1,
      sample: true,
    },
  ]

  return { nodes, edges }
}

function demoFeed(now: number, wallets: WhaleWalletRow[]): WhaleFeedEvent[] {
  const byId = Object.fromEntries(wallets.map((w) => [w.id, w]))
  const events: WhaleFeedEvent[] = [
    {
      id: 'f1',
      at: new Date(now - 2 * 60_000).toISOString(),
      type: 'ACCUMULATION',
      tone: 'accum',
      walletLabel: byId.w1!.label,
      walletAddress: byId.w1!.address,
      tokenSymbol: 'SOLCAT',
      tokenMint: byId.w1!.focusMint,
      description: 'Smart money net +$182k across 3 tracked wallets',
      usdNotional: 182_000,
      sample: true,
    },
    {
      id: 'f2',
      at: new Date(now - 8 * 60_000).toISOString(),
      type: 'BUY',
      tone: 'accum',
      walletLabel: byId.w9!.label,
      walletAddress: byId.w9!.address,
      tokenSymbol: 'SOLCAT',
      tokenMint: byId.w9!.focusMint,
      description: 'Fresh wallet opened SOLCAT · first touch <14h age',
      usdNotional: 22_400,
      sample: true,
    },
    {
      id: 'f3',
      at: new Date(now - 14 * 60_000).toISOString(),
      type: 'LIQUIDITY_MOVE',
      tone: 'accum',
      walletLabel: 'Pool desk',
      walletAddress: 'POOL····························',
      tokenSymbol: 'SOLCAT',
      tokenMint: byId.w1!.focusMint,
      description: 'LP depth +21% · Raydium SOLCAT/SOL',
      usdNotional: 48_000,
      sample: true,
    },
    {
      id: 'f4',
      at: new Date(now - 22 * 60_000).toISOString(),
      type: 'DISTRIBUTION',
      tone: 'dist',
      walletLabel: byId.w4!.label,
      walletAddress: byId.w4!.address,
      tokenSymbol: 'NOODLE',
      tokenMint: byId.w4!.focusMint,
      description: 'Smart money exiting · −$41k tracked outflow',
      usdNotional: 41_000,
      sample: true,
    },
    {
      id: 'f5',
      at: new Date(now - 40 * 60_000).toISOString(),
      type: 'INSIDER_SIGNAL',
      tone: 'watch',
      walletLabel: byId.w7!.label,
      walletAddress: byId.w7!.address,
      tokenSymbol: 'NOODLE',
      tokenMint: byId.w7!.focusMint,
      description: 'Deployer-prox cluster transfer · elevated insider risk',
      usdNotional: null,
      sample: true,
    },
    {
      id: 'f6',
      at: new Date(now - 55 * 60_000).toISOString(),
      type: 'SELL',
      tone: 'dist',
      walletLabel: byId.w8!.label,
      walletAddress: byId.w8!.address,
      tokenSymbol: 'NOODLE',
      tokenMint: byId.w8!.focusMint,
      description: 'LP remove detected · liquidity thinning',
      usdNotional: 28_000,
      sample: true,
    },
    {
      id: 'f7',
      at: new Date(now - 70 * 60_000).toISOString(),
      type: 'BUY',
      tone: 'accum',
      walletLabel: byId.w3!.label,
      walletAddress: byId.w3!.address,
      tokenSymbol: 'WHALE',
      tokenMint: byId.w3!.focusMint,
      description: 'MM cluster accumulation · +$95k',
      usdNotional: 95_000,
      sample: true,
    },
  ]
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

function demoConsensus(wallets: WhaleWalletRow[]): WhaleConsensusMetrics {
  const avgConf =
    wallets.reduce((a, w) => a + w.confidenceScore, 0) / Math.max(1, wallets.length)
  const accum = wallets.filter((w) => w.lastAction === 'BUY' || w.lastAction === 'HOLD').length
  const dist = wallets.filter(
    (w) => w.lastAction === 'SELL' || w.lastAction === 'LP_REMOVE',
  ).length
  const insider = wallets.filter((w) => w.cohort === 'insider_pattern').length

  return {
    smartMoneyScore: 78,
    whaleConviction: Math.round(avgConf * 0.9),
    insiderRisk: Math.min(95, 35 + insider * 18),
    distributionProbability: Math.round((dist / Math.max(1, accum + dist)) * 100),
    marketInfluence: 71,
    confidence: Math.round(avgConf),
    bias: accum > dist + 1 ? 'accumulation' : dist > accum ? 'distribution' : 'mixed',
    summary:
      'Smart money net constructive on SOLCAT; NOODLE showing distribution + insider-prox activity. Size only after liquidity risk clears.',
    sample: true,
  }
}

function buildDemoBundle(): WhaleIntelligenceBundle {
  const now = Date.now()
  const wallets = demoWallets(now)
  const { nodes, edges } = demoGraph(wallets)
  const feed = demoFeed(now, wallets)
  const consensus = demoConsensus(wallets)

  const cohorts = (Object.keys(COHORT_LABELS) as WhaleCohortId[]).map((id) => ({
    id,
    label: COHORT_LABELS[id],
    count: wallets.filter((w) => w.cohort === id).length,
  }))

  return {
    mode: 'demo',
    cohorts,
    wallets,
    nodes,
    edges,
    feed,
    consensus,
    methodNote: 'whale-intelligence-v1 · demo desk',
    sample: true,
  }
}

function buildLiveEmpty(): WhaleIntelligenceBundle {
  const cohorts = (Object.keys(COHORT_LABELS) as WhaleCohortId[]).map((id) => ({
    id,
    label: COHORT_LABELS[id],
    count: 0,
  }))
  return {
    mode: 'live',
    cohorts,
    wallets: [],
    nodes: [],
    edges: [],
    feed: [],
    consensus: {
      smartMoneyScore: 0,
      whaleConviction: 0,
      insiderRisk: 0,
      distributionProbability: 0,
      marketInfluence: 0,
      confidence: 0,
      bias: 'neutral',
      summary: 'Whale feeds offline — connect smart-money stream to populate consensus.',
      sample: false,
    },
    methodNote: 'whale-intelligence-v1 · live awaiting feeds',
    sample: false,
  }
}

export function buildWhaleIntelligence(mode: TerminalDataMode): WhaleIntelligenceBundle {
  if (mode === 'demo') return buildDemoBundle()
  return buildLiveEmpty()
}

export function cohortLabel(id: WhaleCohortId): string {
  return COHORT_LABELS[id]
}

export function formatWhaleTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toISOString().slice(11, 19)
}

export function formatUsdSigned(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}
