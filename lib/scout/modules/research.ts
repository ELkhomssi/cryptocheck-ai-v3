/**
 * Scout V2 research adapters — live engines only, fail open.
 * Never fabricates Trends/Twitter/Reddit counts. Surfaces evidence lines for the writer.
 */

import 'server-only'

import {
  fetchLiveMarketOverview,
  fetchLiveTopTokens,
  fetchLiveWhaleMovements,
} from '@/lib/terminal-os/live-market'
import type { ScoutTopic } from '@/lib/scout/types'

function slugId(prefix: string, seed: string): string {
  const clean = seed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'topic'
  return `${prefix}-${clean}-${Date.now().toString(36)}`
}

export type ResearchBundle = {
  topics: ScoutTopic[]
  citations: string[]
  sourcesTouched: string[]
}

/** CoinGecko global + DexScreener multi-chain + whale flow — ecosystem-framed. */
export async function gatherExtendedResearch(gatheredAt: string): Promise<ResearchBundle> {
  const topics: ScoutTopic[] = []
  const citations: string[] = []
  const sourcesTouched: string[] = []

  const [overview, whales, solTokens, baseTokens, ethTokens] = await Promise.all([
    fetchLiveMarketOverview().catch(() => null),
    fetchLiveWhaleMovements(8).catch(() => []),
    fetchLiveTopTokens('solana', 6).catch(() => []),
    fetchLiveTopTokens('base', 4).catch(() => []),
    fetchLiveTopTokens('ethereum', 4).catch(() => []),
  ])

  if (overview && overview.marketCapUsd > 0) {
    sourcesTouched.push('coingecko')
    citations.push('coingecko:global')
    topics.push({
      id: slugId('cg', 'global'),
      title: 'Capital rotation and market structure inside Terminal OS',
      narrative: `CoinGecko global: mcap $${Math.round(overview.marketCapUsd).toLocaleString()} · 24h ${overview.marketCapChange24hPct?.toFixed?.(2) ?? overview.marketCapChange24hPct}% · BTC dominance ${overview.btcDominancePct?.toFixed?.(1) ?? overview.btcDominancePct}%.`,
      source: 'market-analyst',
      evidenceLine: `coingecko · mcap=${overview.marketCapUsd} · vol24h=${overview.volume24hUsd} · btcDom=${overview.btcDominancePct}`,
      discoveredAt: gatheredAt,
      pillar: 'capital_rotation',
      engineCited: true,
      priorityScore: 72,
    })
  }

  if (whales?.length) {
    sourcesTouched.push('whale-feed')
    citations.push('live-market:whales')
    const top = whales[0]!
    topics.push({
      id: slugId('whale', top.assetSymbol || 'flow'),
      title: 'Whale movements as context — not commands to copy',
      narrative: `Live flow context: ${top.assetSymbol} ${top.action} · ~$${Math.round(top.usdValue).toLocaleString()} · ${top.classificationWhy || top.chain}.`,
      source: 'whale-feed',
      symbol: top.assetSymbol || null,
      mint: top.tokenMint || null,
      evidenceLine: top.classificationWhy || `${top.action} ${top.usdValue} on ${top.chain}`,
      discoveredAt: gatheredAt,
      pillar: 'whale_intelligence',
      engineCited: true,
      priorityScore: 70,
    })
  }

  const chainRows: Array<{ chain: string; rows: Awaited<ReturnType<typeof fetchLiveTopTokens>> }> = [
    { chain: 'solana', rows: solTokens || [] },
    { chain: 'base', rows: baseTokens || [] },
    { chain: 'ethereum', rows: ethTokens || [] },
  ]

  for (const { chain, rows } of chainRows) {
    if (!rows.length) continue
    sourcesTouched.push(`dexscreener:${chain}`)
    citations.push(`dexscreener:top:${chain}`)
    const row = rows[0]!
    const symbol = row.symbol || row.name || chain.toUpperCase()
    const mintCandidate = row.id?.length >= 32 ? row.id : null
    topics.push({
      id: slugId('eco', `${chain}-${symbol}`),
      title: `${chain} ecosystem watch: Discovery before FOMO`,
      narrative: `DexScreener ${chain} leader ${symbol} routed into Discovery Engine + Security Scanner before any Terminal OS size.`,
      source: 'dexscreener-trending',
      symbol: String(symbol),
      mint: mintCandidate,
      evidenceLine: `dexscreener:${chain} · ${symbol} · vol=${row.volume24hUsd ?? 'n/a'} · chg=${row.change24hPct ?? 'n/a'}`,
      discoveredAt: gatheredAt,
      pillar: chain === 'solana' ? 'discovery_engine' : 'decision_intelligence',
      engineCited: true,
      priorityScore: 66,
    })
  }

  // Narrative seeds that map master-prompt research themes → pillars (no fabricated stats)
  const narrativeSeeds: Array<Pick<ScoutTopic, 'title' | 'pillar' | 'priorityScore' | 'narrative'>> = [
    {
      title: 'AI in crypto: why Decision Intelligence beats indicator stacks',
      pillar: 'decision_intelligence',
      priorityScore: 74,
      narrative:
        'AI + trading narratives intensify — Terminal OS treats AI as a gated decision workflow, not a tip channel.',
    },
    {
      title: 'Security incidents and rug risk as an operating-system concern',
      pillar: 'security_scanner',
      priorityScore: 76,
      narrative:
        'Emerging exploit / rug narratives require Security Scanner before Discovery urgency becomes size.',
    },
    {
      title: 'Stablecoin and regulation context for Portfolio Intelligence',
      pillar: 'portfolio_intelligence',
      priorityScore: 64,
      narrative:
        'Stablecoin and regulation headlines affect capital rotation — Portfolio Intelligence keeps exposure narrative honest.',
    },
    {
      title: 'On-chain analytics without dashboard theater',
      pillar: 'intelligence_chart',
      priorityScore: 71,
      narrative:
        'On-chain analytics only matter when bound to Intelligence Chart + Decision Engine inside Terminal OS.',
    },
  ]

  for (const seed of narrativeSeeds) {
    topics.push({
      id: slugId('narr', seed.pillar || 'eco'),
      title: seed.title,
      narrative: seed.narrative,
      source: 'ecosystem-pillar',
      evidenceLine: `narrative-theme:${seed.pillar} · anchored to live citations=${citations.length}`,
      discoveredAt: gatheredAt,
      pillar: seed.pillar,
      engineCited: citations.length > 0,
      priorityScore: seed.priorityScore,
    })
  }

  return { topics, citations, sourcesTouched: [...new Set(sourcesTouched)] }
}
