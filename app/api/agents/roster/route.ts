/**
 * GET /api/agents/roster — built-in + custom employees with latest performance snapshots.
 * Also returns Team Overview computed stats (Phase 11 §5).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  countActiveAgents,
  countAgentAlertsToday,
  countRunningTasks,
  latestPerformanceSnapshots,
  listAllEmployees,
} from '@/lib/agents/store'
import type { AgentPerformanceSnapshot, AIEmployee } from '@/types/agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type RosterEmployeeView = AIEmployee & {
  performance: {
    score: number | null
    sampleSize: number
    calibrating: boolean
    computedAt: string | null
  }
  currentActivity: string
}

function viewFor(
  emp: AIEmployee,
  snap: AgentPerformanceSnapshot | undefined,
  lastDesc: string | null,
): RosterEmployeeView {
  const min = emp.performanceFormula.minSamples
  const sampleSize = snap?.sampleSize ?? 0
  const calibrating =
    !snap ||
    snap.calibrating ||
    snap.score == null ||
    sampleSize < min
  return {
    ...emp,
    // Never expose full system prompt templates to the client — strip to short marker.
    systemPromptTemplate: emp.builtin ? '[builtin]' : '[custom]',
    performance: {
      score: calibrating ? null : snap!.score,
      sampleSize,
      calibrating,
      computedAt: snap?.computedAt ?? null,
    },
    currentActivity: lastDesc || (calibrating ? 'Calibrating performance…' : 'Ready'),
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  const employees = await listAllEmployees(wallet)
  const snaps = await latestPerformanceSnapshots(employees.map((e) => e.id))

  // Latest activity description per agent (for one-line current activity).
  let lastByAgent = new Map<string, string>()
  try {
    const { listAgentActivity } = await import('@/lib/agents/store')
    const recent = await listAgentActivity(80)
    for (const row of recent) {
      if (!lastByAgent.has(row.agentId)) {
        lastByAgent.set(row.agentId, row.description || row.kind)
      }
    }
  } catch {
    lastByAgent = new Map()
  }

  const views = employees.map((e) => viewFor(e, snaps.get(e.id), lastByAgent.get(e.id) ?? null))

  const scored = views.filter((v) => !v.performance.calibrating && v.performance.score != null)
  const successRate =
    scored.length === 0
      ? null
      : Math.round(
          scored.reduce((a, v) => a + (v.performance.score as number), 0) / scored.length,
        )

  const [activeNow, tasksRunning, alertsToday] = await Promise.all([
    countActiveAgents(15),
    countRunningTasks(),
    countAgentAlertsToday(),
  ])

  return NextResponse.json({
    employees: views,
    overview: {
      totalEmployees: views.length,
      activeNow,
      tasksRunning,
      alertsToday,
      successRate,
    },
    anthropicAvailable: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    fetchedAt: new Date().toISOString(),
  })
}
