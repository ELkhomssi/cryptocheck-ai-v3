import 'server-only'

/**
 * Scout ↔ CryptoCheckAI engines.
 * Never imports frozen scanner-engine / canonical-scan / institutional pipeline.
 */

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { buildMarketAnalystBrief } from '@/lib/portfolio-desk/market-analyst'
import { getNewLaunchesFeed, getTrendingFeed } from '@/lib/terminal/market-feeds'
import type { ScreenerRow } from '@/lib/providers/types'
import { pickEcosystemSeeds } from '@/lib/scout/strategy'
import { gatherExtendedResearch } from '@/lib/scout/modules/research'
import type { ScoutTopic } from '@/lib/scout/types'

export type ScoutEngineSnapshot = {
  topics: ScoutTopic[]
  marketBriefSummary: string | null
  marketBriefSources: string[]
  citations: string[]
  researchSources: string[]
  gatheredAt: string
}

function slugId(prefix: string, seed: string): string {
  const clean = seed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'topic'
  return `${prefix}-${clean}-${Date.now().toString(36)}`
}

function asScreenerRows(items: unknown[]): ScreenerRow[] {
  return items.filter((r): r is ScreenerRow => Boolean(r && typeof r === 'object' && 'mint' in (r as object)))
}

/**
 * Gather live research — fail open with empty sets.
 * Priority filtering + learning boosts happen in the pipeline (post-gather).
 */
export async function gatherScoutIntelligence(opts?: {
  focusMint?: string | null
}): Promise<ScoutEngineSnapshot> {
  const citations: string[] = []
  const researchSources: string[] = []
  const topics: ScoutTopic[] = []
  const gatheredAt = new Date().toISOString()

  const [trending, launches, extended] = await Promise.all([
    getTrendingFeed(12).catch(() => null),
    getNewLaunchesFeed(8).catch(() => null),
    gatherExtendedResearch(gatheredAt).catch(() => ({
      topics: [] as ScoutTopic[],
      citations: [] as string[],
      sourcesTouched: [] as string[],
    })),
  ])

  if (extended.sourcesTouched.length) researchSources.push(...extended.sourcesTouched)
  if (extended.citations.length) citations.push(...extended.citations)
  topics.push(...extended.topics)

  const screenerForBrief = asScreenerRows((trending?.items as unknown[]) ?? []).slice(0, 20)
  let marketBrief: Awaited<ReturnType<typeof buildMarketAnalystBrief>> | null = null
  try {
    marketBrief = buildMarketAnalystBrief({
      screenerRows: screenerForBrief,
      quotes: null,
      available: screenerForBrief.length > 0,
      source: trending?.source ?? null,
      loading: false,
    })
  } catch (err) {
    console.error('[scout] buildMarketAnalystBrief', err)
  }

  if (trending?.items?.length && !trending.error) {
    researchSources.push(`market-feeds:${trending.source || 'trending'}`)
    citations.push(`market-feeds:trending:${trending.source || 'unknown'}`)
    for (const row of screenerForBrief.slice(0, 6)) {
      const symbol = String(row.symbol || row.name || 'TOKEN')
      const mint = typeof row.mint === 'string' ? row.mint : null
      topics.push({
        id: slugId('trend', mint ?? symbol),
        title: `${symbol} in Terminal OS — trending feed context`,
        narrative: `Live trending signal for ${symbol} routed into Terminal OS desks (Discovery + Intelligence Chart + Scanner).`,
        source: String(trending.source || '').includes('dex')
          ? 'dexscreener-trending'
          : 'birdeye-trending',
        mint,
        symbol,
        evidenceLine: `Source=${trending.source} · change24h=${row.change24hPct ?? 'n/a'} · vol=${row.volume24hUsd ?? 'n/a'}`,
        discoveredAt: gatheredAt,
        pillar: 'discovery_engine',
        engineCited: true,
        priorityScore: 58,
      })
    }
  }

  if (launches?.items?.length && !launches.error) {
    researchSources.push(`market-feeds:new-launches:${launches.source || 'unknown'}`)
    citations.push(`market-feeds:new-launches:${launches.source || 'unknown'}`)
    for (const row of asScreenerRows(launches.items as unknown[]).slice(0, 4)) {
      const symbol = String(row.symbol || row.name || 'NEW')
      const mint = typeof row.mint === 'string' ? row.mint : null
      topics.push({
        id: slugId('launch', mint ?? symbol),
        title: `New launch diligence: ${symbol} before Terminal OS size`,
        narrative: `New listing / pool activity for ${symbol} — Discovery Engine feeds Security Scanner before any execution path.`,
        source: 'new-launches',
        mint,
        symbol,
        evidenceLine: `Source=${launches.source} · liquidity=${row.liquidityUsd ?? 'n/a'}`,
        discoveredAt: gatheredAt,
        pillar: 'security_scanner',
        engineCited: true,
        priorityScore: 60,
      })
    }
  }

  let marketBriefSummary: string | null = null
  const marketBriefSources: string[] = []
  if (marketBrief && !marketBrief.unavailableReason) {
    researchSources.push('market-analyst')
    citations.push('portfolio-desk:market-analyst')
    marketBriefSummary =
      [marketBrief.openingLine, marketBrief.executiveConclusion, marketBrief.convictionLine]
        .filter(Boolean)
        .join(' ') || null
    if (marketBrief.sourcesNote) marketBriefSources.push(marketBrief.sourcesNote)
    if (marketBriefSummary) {
      topics.push({
        id: slugId('mkt', 'brief'),
        title: 'Market structure brief for Decision Intelligence',
        narrative: marketBriefSummary.slice(0, 280),
        source: 'market-analyst',
        evidenceLine: 'Derived from buildMarketAnalystBrief() — not model invention.',
        discoveredAt: gatheredAt,
        pillar: 'decision_intelligence',
        engineCited: true,
        priorityScore: 68,
      })
    }
  }

  const focusMint = opts?.focusMint?.trim()
  if (focusMint && focusMint.length >= 32) {
    try {
      const risk = await assessRiskByMint(focusMint, 'solana', 'fast')
      researchSources.push('scan-gateway')
      citations.push(`scan-gateway:${focusMint.slice(0, 8)}`)
      const evidence =
        risk.snapshot?.reasoning?.evidence?.[0]?.detail ||
        risk.snapshot?.reasoning?.verdict ||
        `verdict=${risk.verdict}`
      topics.unshift({
        id: slugId('scan', focusMint),
        title: `Security Scanner context before Terminal OS execution`,
        narrative: `Gateway verdict ${risk.verdict} · safety ${risk.safetyScore}/100 · confidence ${risk.confidence}.`,
        source: 'scan-gateway',
        mint: focusMint,
        symbol: null,
        evidenceLine: String(evidence),
        discoveredAt: gatheredAt,
        pillar: 'security_scanner',
        engineCited: true,
        priorityScore: 78,
      })
    } catch (err) {
      console.error('[scout] assessRiskByMint', err)
    }
  }

  const topSymbol = topics.find((t) => t.symbol)?.symbol
  const evidenceAnchor =
    marketBriefSummary?.slice(0, 160) ||
    topics[0]?.evidenceLine ||
    'Cycle ran with limited feeds — Scout still educates on Terminal OS without inventing market stats.'

  if (citations.length === 0) {
    citations.push('scout:ecosystem-pillar:v2')
  }

  for (const pillar of pickEcosystemSeeds(3, gatheredAt + (topSymbol ?? ''))) {
    const idx = Math.abs([...pillar.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % pillar.seedTitles.length
    const seed = pillar.seedTitles[idx]!
    topics.push({
      id: slugId('eco', pillar.id),
      title: seed,
      narrative: `${pillar.ccaiSolution} Live anchor: ${evidenceAnchor}`,
      source: 'ecosystem-pillar',
      symbol: topSymbol ?? null,
      mint: topics.find((t) => t.mint)?.mint ?? null,
      evidenceLine: evidenceAnchor,
      discoveredAt: gatheredAt,
      pillar: pillar.id,
      engineCited: citations.length > 0,
      priorityScore: 55 + pillar.priorityBoost,
    })
  }

  researchSources.push('ecosystem-pillars')

  return {
    topics,
    marketBriefSummary,
    marketBriefSources,
    citations: [...new Set(citations)],
    researchSources: [...new Set(researchSources)],
    gatheredAt,
  }
}
