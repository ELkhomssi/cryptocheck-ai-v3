/**
 * GET /api/intelligence/modules/[id]
 * Detail: memory + timeline (filtered mission feed) + score graph history.
 */

import { NextRequest, NextResponse } from 'next/server'
import { listAgentActivity } from '@/lib/agents/store'
import { buildModuleCard } from '@/lib/intelligence/assemble'
import { getModuleMemory } from '@/lib/intelligence/memory'
import { workerIdsForModule } from '@/lib/intelligence/modules'
import { listIntelligenceScoreHistory } from '@/lib/intelligence/score'
import { latestPerformanceSnapshots } from '@/lib/agents/store'
import type { IntelligenceModuleId } from '@/types/intelligence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const VALID: IntelligenceModuleId[] = [
  'market',
  'security',
  'trading',
  'portfolio',
  'launch',
  'research',
]

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const id = ctx.params.id as IntelligenceModuleId
  if (!VALID.includes(id)) {
    return NextResponse.json({ error: 'unknown module' }, { status: 404 })
  }

  const daysParam = Number(req.nextUrl.searchParams.get('days') || '7')
  const days = daysParam === 30 ? 30 : 7

  try {
    const workers = new Set(workerIdsForModule(id))
    const [card, memory, history, activity, perfSnaps] = await Promise.all([
      buildModuleCard(id),
      getModuleMemory(id),
      listIntelligenceScoreHistory(id, days),
      listAgentActivity(80),
      latestPerformanceSnapshots([...workers]),
    ])

    const timeline = activity
      .filter((a) => workers.has(a.agentId))
      .map((a) => ({
        id: a.id,
        title: a.description || `${a.kind} ${a.status}`,
        detail: a.status,
        at: a.createdAt,
        kind: a.kind,
      }))

    // Module-specific series from latest worker performance (for graph overlay).
    // History gaps are intentional — we only return real snapshot points.
    const subMetrics = [...perfSnaps.values()].map((s) => ({
      agentId: s.agentId,
      score: s.calibrating ? null : s.score,
      calibrating: s.calibrating,
      computedAt: s.computedAt,
    }))

    return NextResponse.json({
      card,
      memory,
      timeline,
      graph: {
        days,
        intelligenceScore: history.map((h) => ({
          t: h.computedAt,
          score: h.calibrating ? null : h.score,
          calibrating: h.calibrating,
          avgWorkerPerformance: h.avgWorkerPerformance,
          providerUptimePct: h.providerUptimePct,
          dataFreshnessPct: h.dataFreshnessPct,
        })),
        // No synthetic interpolation — client must render gaps / shorter range.
        subMetrics,
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[intelligence/modules/id]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
