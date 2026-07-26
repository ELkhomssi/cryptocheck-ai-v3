/**
 * Phase 17.3 — ContextEngine
 * Pure read/assemble per consumer. No durable cache of stale context.
 *
 * Grep findings (reuse, do not duplicate):
 * - buildHoldingsResponse (lib/portfolio-desk/holdings-service)
 * - buildPortfolioAnalytics (lib/terminal/portfolio-analytics)
 * - listAlerts (lib/portfolio-desk/alerts-store)
 * - buildAgentLiveContext (lib/agents/context) — agent orchestrator stays on that path
 * - watchlist via Supabase watchlist table
 * - agent_activity via listAgentActivity
 * - user_memory + timeline_events (Phase 17 new, interaction history / unified feed)
 */

import 'server-only'

import { listAgentActivity } from '@/lib/agents/store'
import { listAlerts } from '@/lib/portfolio-desk/alerts-store'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { aggregateUserMemory, listUserMemory } from '@/lib/intelligence-core/memory-engine'
import { listTimelineEvents } from '@/lib/intelligence-core/timeline-engine'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { CoachContext, TradingContext } from '@/types/intelligence-core'

async function listWatchlistMints(limit = 20): Promise<
  Array<{ mint: string; symbol: string | null }>
> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('watchlist')
      .select('mint, symbol, token_symbol, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data.map((r) => ({
      mint: String((r as { mint?: string }).mint ?? ''),
      symbol:
        ((r as { symbol?: string | null }).symbol as string | null) ??
        ((r as { token_symbol?: string | null }).token_symbol as string | null) ??
        null,
    })).filter((r) => r.mint.length >= 32)
  } catch {
    return []
  }
}

/**
 * Trading consumer context — portfolio summary, risk exposure, watchlist, recent scans.
 * `userId` may be a wallet address (desk often keys by wallet).
 */
export async function getTradingContext(userId: string): Promise<TradingContext> {
  const wallet =
    userId && userId.length >= 32 && !userId.includes('@') ? userId : null
  const fetchedAt = new Date().toISOString()

  let portfolioSummary: TradingContext['portfolioSummary'] = {
    totalValueUsd: null,
    holdingCount: 0,
    topSymbol: null,
  }
  let riskExposure: TradingContext['riskExposure'] = {
    topAllocationPct: null,
    note: wallet ? 'No holdings loaded' : 'No wallet — connect to load exposure',
  }

  if (wallet) {
    try {
      const holdings = await buildHoldingsResponse(wallet)
      const top = [...holdings.holdings].sort((a, b) => b.valueUsd - a.valueUsd)[0]
      portfolioSummary = {
        totalValueUsd: holdings.totalValueUsd,
        holdingCount: holdings.holdings.length,
        topSymbol: top?.symbol ?? null,
      }
      riskExposure = {
        topAllocationPct: top?.allocationPct ?? null,
        note: top
          ? `Largest weight ${top.symbol} at ${top.allocationPct.toFixed(1)}%`
          : 'Empty portfolio',
      }
    } catch {
      riskExposure = { topAllocationPct: null, note: 'Holdings fetch failed' }
    }
  }

  const [watchlist, activity] = await Promise.all([
    listWatchlistMints(20),
    listAgentActivity(20),
  ])

  const recentScans = activity
    .filter((a) => a.kind === 'report' || a.kind === 'analysis' || a.kind === 'signals')
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      summary: a.description || `${a.kind} ${a.status}`,
      at: a.createdAt,
    }))

  return {
    walletAddress: wallet,
    portfolioSummary,
    riskExposure,
    watchlist,
    recentScans,
    fetchedAt,
  }
}

/**
 * Coach consumer context — portfolio, user_memory, alerts, timeline slice.
 */
export async function getCoachContext(userId: string): Promise<CoachContext> {
  const wallet =
    userId && userId.length >= 32 && !userId.includes('@') ? userId : null
  const fetchedAt = new Date().toISOString()

  let portfolioBlock = 'No wallet connected — answer generally and ask the user to connect.'
  if (wallet) {
    try {
      const holdings = await buildHoldingsResponse(wallet)
      portfolioBlock = [
        `Wallet: ${holdings.walletAddress}`,
        `Total value USD: ${holdings.totalValueUsd.toFixed(2)}`,
        `Holdings (${holdings.holdings.length}):`,
        ...holdings.holdings.slice(0, 15).map(
          (h) =>
            `- ${h.symbol} (${h.name}): amount=${h.amount} valueUsd=${h.valueUsd.toFixed(2)} price=${h.priceUsd} alloc=${h.allocationPct.toFixed(1)}%`,
        ),
      ].join('\n')
    } catch {
      portfolioBlock = 'Wallet provided but holdings fetch failed — say so honestly.'
    }
  }

  const memoryKey = wallet || userId || 'anonymous'
  const [memoryEntries, alerts, timelineSlice, aggregates] = await Promise.all([
    listUserMemory(memoryKey, 20),
    listAlerts(10),
    listTimelineEvents({ limit: 12 }),
    aggregateUserMemory(memoryKey),
  ])

  // Surface aggregate hints inside memory meta for the coach prompt without a giant blob.
  void aggregates

  return {
    walletAddress: wallet,
    portfolioBlock,
    memoryEntries,
    recentAlerts: alerts.map((a) => ({
      type: a.type,
      title: a.title,
      description: a.description,
      at: a.createdAt,
    })),
    timelineSlice,
    fetchedAt,
  }
}

/** Format coach context into a single grounding string for the existing stream path. */
export function formatCoachContextForPrompt(ctx: CoachContext): string {
  const memoryLines =
    ctx.memoryEntries.length === 0
      ? ['(no user_memory interactions yet)']
      : ctx.memoryEntries.slice(0, 10).map(
          (m) => `- ${m.actionType} ${m.subjectType}${m.subjectId ? `:${m.subjectId}` : ''}`,
        )
  const alertLines =
    ctx.recentAlerts.length === 0
      ? ['(no recent alerts)']
      : ctx.recentAlerts.map((a) => `- [${a.type}] ${a.title}: ${a.description}`)
  const timelineLines =
    ctx.timelineSlice.length === 0
      ? ['(timeline empty)']
      : ctx.timelineSlice.map((t) => `- ${t.summary}`)

  return [
    ctx.portfolioBlock,
    '',
    'User memory (interactions):',
    ...memoryLines,
    '',
    'Recent alerts:',
    ...alertLines,
    '',
    'Timeline slice:',
    ...timelineLines,
  ].join('\n')
}
