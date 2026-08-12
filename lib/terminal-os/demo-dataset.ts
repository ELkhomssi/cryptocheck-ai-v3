/**
 * Frozen labeled demo dataset — insurance for venue outages.
 * Always tagged demo:true in envelopes. Never pretend to be live.
 */

import type {
  MarketOverview,
  TickerQuote,
  TokenRow,
  TopTrader,
  WhaleMovement,
} from '@/features/terminal-os/shared/types'
import { enrichWhaleMovement } from '@/features/terminal-os/shared/lib/enrich-whale-movement'
import { classifyWhaleMovement } from '@/features/terminal-os/shared/lib/classify-whale-movement'

export const DEMO_TICKER: TickerQuote[] = [
  { symbol: 'SOL', priceUsd: 168.42, change24hPct: 2.35 },
  { symbol: 'BTC', priceUsd: 67_850, change24hPct: 0.82 },
  { symbol: 'ETH', priceUsd: 3_420.5, change24hPct: 1.14 },
  { symbol: 'BNB', priceUsd: 598.2, change24hPct: -0.41 },
]

export const DEMO_OVERVIEW: MarketOverview = {
  marketCapUsd: 2.48e12,
  volume24hUsd: 92e9,
  btcDominancePct: 52.4,
  altcoinIndex: 48,
  marketCapChange24hPct: 1.2,
  fetchedAt: new Date().toISOString(),
  source: 'demo-frozen',
}

function spark(): number[] {
  return [42, 44, 43, 48, 51, 49, 53, 55, 52, 58, 56, 60]
}

export const DEMO_TOKENS: TokenRow[] = [
  {
    id: 'demo-wif',
    symbol: 'WIF',
    name: 'dogwifhat',
    chain: 'solana',
    priceUsd: 2.14,
    change24hPct: 8.2,
    volume24hUsd: 84_000_000,
    liquidityUsd: 18_000_000,
    marketCapUsd: 2.1e9,
    txCount24h: 38_000,
    buySellRatio: 1.22,
    sparkline: spark(),
  },
  {
    id: 'demo-bonk',
    symbol: 'BONK',
    name: 'Bonk',
    chain: 'solana',
    priceUsd: 0.000024,
    change24hPct: 5.1,
    volume24hUsd: 52_000_000,
    liquidityUsd: 9_500_000,
    marketCapUsd: 1.5e9,
    txCount24h: 51_000,
    buySellRatio: 1.11,
    sparkline: spark(),
  },
  {
    id: 'demo-pepe',
    symbol: 'PEPE',
    name: 'Pepe',
    chain: 'ethereum',
    priceUsd: 0.0000098,
    change24hPct: -2.4,
    volume24hUsd: 110_000_000,
    liquidityUsd: 28_000_000,
    marketCapUsd: 3.8e9,
    txCount24h: 22_000,
    buySellRatio: 0.94,
    sparkline: spark(),
  },
  {
    id: 'demo-degen',
    symbol: 'DEGEN',
    name: 'Degen',
    chain: 'base',
    priceUsd: 0.0142,
    change24hPct: 11.5,
    volume24hUsd: 22_000_000,
    liquidityUsd: 4_200_000,
    marketCapUsd: 280_000_000,
    txCount24h: 14_000,
    buySellRatio: 1.35,
    sparkline: spark(),
  },
]

export function demoWhales(): WhaleMovement[] {
  const raw = [
    {
      id: 'demo-w1',
      walletFull: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana' as const,
      action: 'buy' as const,
      assetSymbol: 'WIF',
      usdValue: 2_400_000,
      amount: 1_100_000,
      occurredAt: new Date(Date.now() - 18_000).toISOString(),
      volume24hUsd: 80_000_000,
      liquidityUsd: 18_000_000,
      sampleAttribution: true as const,
      classificationWhy: 'Demo frozen whale flow — labeled sample.',
    },
    {
      id: 'demo-w2',
      walletFull: '0x3a81e8c2f91d4b7c0e9f11aa22bb33cc81ef0012',
      chain: 'ethereum' as const,
      action: 'sell' as const,
      assetSymbol: 'ETH',
      usdValue: 5_100_000,
      amount: 1500,
      occurredAt: new Date(Date.now() - 42_000).toISOString(),
      volume24hUsd: 200_000_000,
      liquidityUsd: 500_000_000,
      sampleAttribution: true as const,
      classificationWhy: 'Demo frozen whale flow — labeled sample.',
    },
    {
      id: 'demo-w3',
      walletFull: '0xb211aabbccddee11223344556677889900aa11bb',
      chain: 'bnb' as const,
      action: 'swap' as const,
      assetSymbol: 'BNB',
      usdValue: 1_200_000,
      amount: 2000,
      occurredAt: new Date(Date.now() - 65_000).toISOString(),
      volume24hUsd: 90_000_000,
      liquidityUsd: 120_000_000,
      sampleAttribution: true as const,
      classificationWhy: 'Demo frozen whale flow — labeled sample.',
    },
  ]
  return raw.map((r) =>
    enrichWhaleMovement(
      {
        ...r,
        classification: classifyWhaleMovement({ action: r.action, usdValue: r.usdValue }),
      },
      classifyWhaleMovement,
    ),
  )
}

export const DEMO_TRADERS: TopTrader[] = [
  {
    id: 'demo-t1',
    handle: 'AlphaDesk',
    avatarInitials: 'AD',
    pnlUsd: 420_000,
    pnlPct: 18.4,
    winRatePct: 64,
    activePositions: 7,
    aiConfidence: 78,
    confidenceWhy: 'Demo frozen persona — labeled sample.',
    volume24hUsd: 12_000_000,
    underlyingSymbol: 'SOL',
  },
  {
    id: 'demo-t2',
    handle: 'TideRunner',
    avatarInitials: 'TR',
    pnlUsd: 210_000,
    pnlPct: 11.2,
    winRatePct: 58,
    activePositions: 4,
    aiConfidence: 71,
    confidenceWhy: 'Demo frozen persona — labeled sample.',
    volume24hUsd: 6_500_000,
    underlyingSymbol: 'WIF',
  },
]
