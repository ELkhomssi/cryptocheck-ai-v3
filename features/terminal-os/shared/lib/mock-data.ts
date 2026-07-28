/**
 * Mock data factories for Phase 1.
 * Numbers are illustrative — panels never hardcode; they call providers.
 * Marked sample: true where product rules require honesty tags.
 */

import type {
  AiAlertItem,
  AiLearningStatus,
  CandleBar,
  ChainId,
  ChainMarketSnapshot,
  CoachInsight,
  DiscoveryOpportunity,
  PortfolioHealthSummary,
  SwapQuotePreview,
  TickerQuote,
  TokenRow,
  TokenScanResult,
  TopTrader,
  WalletScanResult,
  WhaleMovement,
} from '../types'
import { classifyWhaleMovement } from './classify-whale-movement'

function spark(seed: number, n = 16): number[] {
  const out: number[] = []
  let v = 50 + (seed % 20)
  for (let i = 0; i < n; i++) {
    v += Math.sin(seed + i * 0.7) * 3 + ((seed * (i + 3)) % 5) - 2
    out.push(Math.max(1, v))
  }
  return out
}

function candles(seed: number, bars = 48): CandleBar[] {
  const now = Math.floor(Date.now() / 1000)
  let price = 100 + (seed % 40)
  const out: CandleBar[] = []
  for (let i = bars; i >= 0; i--) {
    const open = price
    const drift = Math.sin(seed + i * 0.35) * 2.2 + ((seed + i) % 3) - 1
    const close = Math.max(1, open + drift)
    const high = Math.max(open, close) + 1.2
    const low = Math.min(open, close) - 1.1
    out.push({
      time: now - i * 900,
      open,
      high,
      low,
      close,
      volume: 800 + ((seed * i) % 400),
    })
    price = close
  }
  return out
}

export const MOCK_TICKER: TickerQuote[] = [
  { symbol: 'SOL', priceUsd: 184.64, change24hPct: 4.35 },
  { symbol: 'BTC', priceUsd: 67254, change24hPct: 2.41 },
  { symbol: 'ETH', priceUsd: 3425, change24hPct: 3.19 },
  { symbol: 'BNB', priceUsd: 572.11, change24hPct: 1.87 },
]

export const MOCK_TOP_TRADERS: TopTrader[] = [
  {
    id: 't1',
    handle: 'ChainVision',
    avatarInitials: 'CV',
    pnlUsd: 128_400,
    pnlPct: 42.8,
    winRatePct: 71,
    activePositions: 6,
    aiConfidence: 88,
    confidenceWhy: 'Consistent size discipline + high scan-before-entry rate matched today.',
  },
  {
    id: 't2',
    handle: 'AlphaKing',
    avatarInitials: 'AK',
    pnlUsd: 96_200,
    pnlPct: 31.2,
    winRatePct: 64,
    activePositions: 4,
    aiConfidence: 81,
    confidenceWhy: 'Strong whale-follow entries; slightly elevated FOMO risk on microcaps.',
  },
  {
    id: 't3',
    handle: 'SolSniper',
    avatarInitials: 'SS',
    pnlUsd: 74_850,
    pnlPct: 27.5,
    winRatePct: 68,
    activePositions: 9,
    aiConfidence: 79,
    confidenceWhy: 'Fast exits after +25% targets align with model pattern library.',
  },
  {
    id: 't4',
    handle: 'BasePilot',
    avatarInitials: 'BP',
    pnlUsd: 51_300,
    pnlPct: 19.4,
    winRatePct: 59,
    activePositions: 3,
    aiConfidence: 72,
    confidenceWhy: 'Solid Base-chain rotation timing; thinner history lowers confidence.',
  },
]

const RAW_WHALES: Omit<WhaleMovement, 'classification' | 'classificationWhy'>[] = [
  {
    id: 'w1',
    walletTruncated: '7xK…9f2b',
    chain: 'solana',
    action: 'withdraw',
    assetSymbol: 'SOL',
    usdValue: 23_400_000,
    amount: 125_000,
    occurredAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: 'w2',
    walletTruncated: '0x3a…c81e',
    chain: 'ethereum',
    action: 'buy',
    assetSymbol: 'ETH',
    usdValue: 8_200_000,
    amount: 2400,
    occurredAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'w3',
    walletTruncated: 'DRq…m4k1',
    chain: 'solana',
    action: 'buy',
    assetSymbol: 'WIF',
    usdValue: 1_850_000,
    amount: 420_000,
    occurredAt: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    id: 'w4',
    walletTruncated: '0xb2…11aa',
    chain: 'bnb',
    action: 'sell',
    assetSymbol: 'BNB',
    usdValue: 4_100_000,
    amount: 7200,
    occurredAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
]

export const MOCK_WHALES: WhaleMovement[] = RAW_WHALES.map((w, i) => {
  const preset =
    i === 0
      ? ('Liquidity Migration' as const)
      : i === 1
        ? ('High Conviction Buy' as const)
        : i === 2
          ? ('Accumulation' as const)
          : ('Profit Taking' as const)
  const classification = classifyWhaleMovement({ ...w, classification: preset })
  return {
    ...w,
    classification,
    classificationWhy: `Model labeled ${classification} from action=${w.action} and $${(w.usdValue / 1e6).toFixed(1)}M notional.`,
  }
})

export const MOCK_TOKENS: TokenRow[] = [
  {
    id: 'wif',
    symbol: 'WIF',
    name: 'dogwifhat',
    chain: 'solana',
    priceUsd: 2.84,
    change24hPct: 12.4,
    volume24hUsd: 142_000_000,
    sparkline: spark(11),
  },
  {
    id: 'bonk',
    symbol: 'BONK',
    name: 'Bonk',
    chain: 'solana',
    priceUsd: 0.000028,
    change24hPct: 8.1,
    volume24hUsd: 89_000_000,
    sparkline: spark(22),
  },
  {
    id: 'pepe',
    symbol: 'PEPE',
    name: 'Pepe',
    chain: 'ethereum',
    priceUsd: 0.000012,
    change24hPct: -3.2,
    volume24hUsd: 210_000_000,
    sparkline: spark(33),
  },
  {
    id: 'cake',
    symbol: 'CAKE',
    name: 'PancakeSwap',
    chain: 'bnb',
    priceUsd: 2.12,
    change24hPct: 4.6,
    volume24hUsd: 34_000_000,
    sparkline: spark(44),
  },
  {
    id: 'degen',
    symbol: 'DEGEN',
    name: 'Degen',
    chain: 'base',
    priceUsd: 0.0084,
    change24hPct: 15.7,
    volume24hUsd: 28_000_000,
    sparkline: spark(55),
  },
]

export function mockChainSnapshots(): ChainMarketSnapshot[] {
  const chains: { chain: ChainId; label: string; seed: number }[] = [
    { chain: 'solana', label: 'Solana', seed: 1 },
    { chain: 'bnb', label: 'BNB Chain', seed: 2 },
    { chain: 'base', label: 'Base', seed: 3 },
    { chain: 'all', label: 'Market Overview', seed: 4 },
  ]
  return chains.map((c) => ({
    chain: c.chain,
    label: c.label,
    topTokens: MOCK_TOKENS.filter((t) => c.chain === 'all' || t.chain === c.chain).slice(0, 4),
    candles: candles(c.seed * 17),
  }))
}

export const MOCK_TOKEN_SCAN: TokenScanResult = {
  mintOrAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  symbol: 'WIF',
  score: 92,
  band: 'excellent',
  riskLabel: 'Very Low Risk',
  confidence: 91,
  explanation:
    'Liquidity depth, mint authority revoked, and holder distribution score above peer median.',
  recommendedAction: 'Eligible for normal swap flow — still verify size vs. liquidity.',
  metrics: [
    { label: 'Liquidity', value: 94, why: 'Pool TVL and 24h volume support orderly exits.' },
    { label: 'Contract Safety', value: 96, why: 'No mint/freeze authority; audit heuristics clean.' },
    { label: 'Dev Activity', value: 78, why: 'Steady commits; no sudden ownership transfers.' },
    { label: 'Holder Health', value: 88, why: 'Top-10 concentration within safe band.' },
  ],
}

export const MOCK_WALLET_SCAN: WalletScanResult = {
  address: '7a8x9f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f',
  addressTruncated: '0x7a8…9f2b',
  score: 88,
  band: 'good',
  riskLabel: 'Low Risk',
  confidence: 84,
  explanation: 'No known malicious approvals; funding graph looks organic over 90d.',
  recommendedAction: 'Safe to interact — review unlimited approvals periodically.',
}

export const MOCK_SWAP: SwapQuotePreview = {
  fromSymbol: 'SOL',
  toSymbol: 'USDC',
  fromAmount: 1,
  toAmount: 184.12,
  priceImpactPct: 0.12,
  platformFeeBps: 30,
  executable: false,
}

export const MOCK_LEARNING: AiLearningStatus = {
  phase: 'learning',
  progressPct: 42,
  analyzing: ['Size', 'Timing', 'Strategy', 'Risk'],
  why: 'Model confidence grows with labeled trades, scans, and Pause & Teach rules.',
}

export const MOCK_AI_ALERTS: AiAlertItem[] = [
  {
    id: 'a1',
    kind: 'token',
    title: 'New Token Alert',
    body: '$PEPEAI is pumping 47% — scan before entry.',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    confidence: 76,
  },
  {
    id: 'a2',
    kind: 'whale',
    title: 'Whale Movement',
    body: 'Whale bought 3.2M $WIF — Accumulation signal.',
    occurredAt: new Date(Date.now() - 180_000).toISOString(),
    confidence: 82,
  },
  {
    id: 'a3',
    kind: 'coach',
    title: 'Pattern Watch',
    body: 'Your average exit is 1.4σ early vs. your stated 2x rule.',
    occurredAt: new Date(Date.now() - 400_000).toISOString(),
    confidence: 71,
  },
]

export const MOCK_COACH: CoachInsight[] = [
  {
    id: 'c1',
    headline: 'Your average exit is too early',
    reasoning: 'Last 12 winners exited at +38% median while your stated target is 2x.',
    statistic: 'Median winner exit: +38% vs target +100%',
    expectedImpact: 'Holding to target on similar setups could lift expectancy ~0.4R.',
    confidence: 78,
  },
  {
    id: 'c2',
    headline: 'Repeating a losing pattern',
    reasoning: 'FOMO entries within 8m of a >20% pump without a prior scan.',
    statistic: '4 of last 7 losers match this signature',
    expectedImpact: 'Skipping those entries historically avoided −2.1R drawdown.',
    confidence: 81,
  },
]

export const MOCK_DISCOVERY: DiscoveryOpportunity[] = [
  {
    id: 'd1',
    symbol: 'NARR',
    name: 'NarrativeX',
    opportunityScore: 84,
    risk: 'moderate',
    narrative: 'AI agents × Solana',
    catalyst: 'Smart-money cluster entered 6h ago',
    confidence: 73,
    timeHorizon: '24–72h',
    why: 'Holder growth + whale accumulation without liquidity drain.',
  },
  {
    id: 'd2',
    symbol: 'BASEX',
    name: 'BaseFlux',
    opportunityScore: 77,
    risk: 'high',
    narrative: 'Base ecosystem rotation',
    catalyst: 'VC wallet first buy',
    confidence: 68,
    timeHorizon: '3–7d',
    why: 'Early narrative tag with elevated rug heuristics — size carefully.',
  },
]

export const MOCK_PORTFOLIO: PortfolioHealthSummary = {
  totalAssetsUsd: 248_320,
  pnl24hUsd: 6_840,
  pnl24hPct: 2.84,
  diversificationScore: 71,
  aiHealthScore: 82,
  stabilityScore: 74,
  healthWhy: 'Exposure balanced across chains; correlation risk elevated in memecoins.',
  stabilityWhy: 'Sleep quality of positions: moderate overnight vol drag on 2 names.',
}
