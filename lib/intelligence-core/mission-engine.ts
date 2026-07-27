/**
 * Phase 17.6 — MissionEngine
 * Assembles Mission Control's view model. Owns no business logic —
 * if a number is wrong, the bug is in the source module.
 *
 * Grep findings (reuse):
 * - screener via loadScreenerCorpus / market API patterns
 * - holdings via buildHoldingsResponse
 * - running jobs via agent_activity
 * - modules via lib/intelligence/assemble (Phase 16)
 * - recommendations + reports via RecommendationEngine / ReportEngine
 * - AutomationBridge for live-thinking status
 */

import 'server-only'

import { listAgentActivity } from '@/lib/agents/store'
import { getAutomationBridgeStatus } from '@/lib/intelligence-core/automation-bridge'
import { listRecentRecommendations } from '@/lib/intelligence-core/recommendation-engine'
import { generateReport, getLatestReport } from '@/lib/intelligence-core/report-engine'
import { listUserMemory } from '@/lib/intelligence-core/memory-engine'
import { listTimelineEvents } from '@/lib/intelligence-core/timeline-engine'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { loadScreenerCorpus } from '@/lib/terminal/screener-corpus'
import type { MissionViewModel } from '@/types/intelligence-core'

export async function assembleMissionViewModel(params?: {
  walletAddress?: string | null
  userId?: string | null
}): Promise<MissionViewModel> {
  const wallet = params?.walletAddress?.trim() || null
  const userId = params?.userId?.trim() || null
  const fetchedAt = new Date().toISOString()

  const ownerKeys = [userId, wallet].filter((k): k is string => Boolean(k && k.trim()))

  const [market, portfolio, activity, recommendationsRaw, existingBrief, automation, memory, timeline] =
    await Promise.all([
      loadMarketGlance(),
      loadPortfolioGlance(wallet),
      listAgentActivity(40),
      listRecentRecommendations(5, userId),
      getLatestReport('morning_brief', wallet),
      getAutomationBridgeStatus(),
      userId ? listUserMemory(userId, 5) : Promise.resolve([]),
      ownerKeys.length
        ? listTimelineEvents({ limit: 5, ownerKeys })
        : Promise.resolve([]),
    ])

  // Free tier: Mission briefing stays; full Recommendation Engine output is Pro.
  let recommendations = recommendationsRaw
  if (userId) {
    try {
      const { isEntitled } = await import('@/lib/identity/entitlements')
      if (!(await isEntitled(userId, 'recommendations_full'))) {
        recommendations = []
      }
    } catch {
      recommendations = []
    }
  }

  const running = activity
    .filter((a) => a.status === 'running')
    .filter((a) => {
      if (!userId && !wallet) return true
      if (a.userId && userId && a.userId === userId) return true
      if (a.walletAddress && wallet && a.walletAddress === wallet) return true
      // Global/system jobs without owner — ok to surface as ambient
      return !a.userId && !a.walletAddress
    })
    .map((a) => ({
      id: a.id,
      description: a.description || `${a.kind} running`,
      kind: a.kind,
    }))

  // Brand-new user: no memory, no *user* timeline, no holdings — not the same as a quiet day.
  const noHoldings =
    !portfolio.connected ||
    Boolean(portfolio.error) ||
    (portfolio.totalValueUsd == null && portfolio.topWeightSymbol == null)
  const firstRun =
    Boolean(userId) && memory.length === 0 && timeline.length === 0 && noHoldings

  let dailyBrief: MissionViewModel['dailyBrief']
  if (existingBrief) {
    dailyBrief = {
      title: existingBrief.title,
      body: existingBrief.body,
      insufficientActivity: existingBrief.insufficientActivity,
      pending: false,
      reportId: existingBrief.id,
    }
  } else if (automation.tasksRunning > 0 && automation.liveThinking) {
    dailyBrief = {
      title: 'Morning Brief',
      body: automation.liveThinking,
      insufficientActivity: false,
      pending: true,
      reportId: null,
    }
  } else {
    const generated = await generateReport({
      reportType: 'morning_brief',
      walletAddress: wallet,
      userId,
    })
    dailyBrief = {
      title: generated.title,
      body: generated.body,
      insufficientActivity: generated.insufficientActivity,
      pending: false,
      reportId: generated.id.startsWith('ephemeral') ? null : generated.id,
    }
  }

  return {
    market,
    portfolio,
    running,
    recommendations,
    dailyBrief,
    firstRun,
    userId,
    fetchedAt,
  }
}

async function loadMarketGlance(): Promise<MissionViewModel['market']> {
  try {
    const corpus = await loadScreenerCorpus({
      sortBy: 'volume',
      sortType: 'desc',
      offset: 0,
      limit: 12,
      wantTrending: false,
      wantNew: false,
      skipTokenList: false,
    })
    const rows = corpus.rows ?? []
    if (!rows.length) {
      return {
        available: false,
        aggregateChange24hPct: null,
        topMoverSymbol: null,
        topMoverChange24hPct: null,
        spark: [],
      }
    }
    const avg =
      rows.reduce((s, r) => s + (Number.isFinite(r.change24hPct) ? r.change24hPct : 0), 0) /
      rows.length
    const top = [...rows].sort(
      (a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct),
    )[0]
    return {
      available: true,
      aggregateChange24hPct: avg,
      topMoverSymbol: top?.symbol ?? null,
      topMoverChange24hPct: top?.change24hPct ?? null,
      spark: rows.slice(0, 8).map((r) => r.change24hPct),
    }
  } catch {
    return {
      available: false,
      aggregateChange24hPct: null,
      topMoverSymbol: null,
      topMoverChange24hPct: null,
      spark: [],
    }
  }
}

async function loadPortfolioGlance(
  wallet: string | null,
): Promise<MissionViewModel['portfolio']> {
  if (!wallet) {
    return {
      connected: false,
      totalValueUsd: null,
      dayChangePct: null,
      topWeightSymbol: null,
      error: null,
    }
  }
  try {
    const holdings = await buildHoldingsResponse(wallet)
    const hs = holdings.holdings
    const top = [...hs].sort((a, b) => b.valueUsd - a.valueUsd)[0]
    const withChg = hs.filter((h) => h.change24hPct != null && h.valueUsd > 0)
    let dayChangePct: number | null = null
    if (withChg.length) {
      const w = withChg.reduce((s, h) => s + h.valueUsd, 0)
      if (w > 0) {
        dayChangePct =
          withChg.reduce((s, h) => s + (h.change24hPct as number) * h.valueUsd, 0) / w
      }
    }
    return {
      connected: true,
      totalValueUsd: holdings.totalValueUsd,
      dayChangePct,
      topWeightSymbol: top?.symbol ?? null,
      error: null,
    }
  } catch (e) {
    return {
      connected: true,
      totalValueUsd: null,
      dayChangePct: null,
      topWeightSymbol: null,
      error: e instanceof Error ? e.message : 'Portfolio fetch failed',
    }
  }
}
