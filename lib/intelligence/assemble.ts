/**
 * Phase 16 — assemble module card / mission strip payloads from real queries.
 */

import {
  countActiveWorkersForModule,
  getModuleDef,
  INTELLIGENCE_MODULES,
} from '@/lib/intelligence/modules'
import { resolveModuleState } from '@/lib/intelligence/module-state'
import { queryModuleStats } from '@/lib/intelligence/module-stats'
import {
  computeModuleIntelligenceScore,
  computeOverallSystemHealth,
  latestIntelligenceScores,
} from '@/lib/intelligence/score'
import type {
  IntelligenceModuleId,
  ModuleCardView,
} from '@/types/intelligence'

export async function buildModuleCard(
  moduleId: IntelligenceModuleId,
  opts?: { liveScore?: boolean },
): Promise<ModuleCardView> {
  const def = getModuleDef(moduleId)
  const [workerCount, state, stats, latestMap] = await Promise.all([
    countActiveWorkersForModule(moduleId),
    resolveModuleState(moduleId),
    queryModuleStats(moduleId),
    latestIntelligenceScores(),
  ])

  let score: number | null = null
  let calibrating = true
  let calibratingReason: string | null = 'No score snapshot yet.'

  const snap = latestMap.get(moduleId)
  if (snap) {
    score = snap.calibrating ? null : snap.score
    calibrating = snap.calibrating || snap.score == null
    calibratingReason = calibrating
      ? ((snap.meta?.calibratingReason as string | undefined) ??
        'Calibrating — insufficient underlying data.')
      : null
  } else if (opts?.liveScore) {
    const live = await computeModuleIntelligenceScore(moduleId)
    score = live.score
    calibrating = live.calibrating
    calibratingReason = live.calibratingReason
  }

  return {
    id: moduleId,
    displayName: def?.displayName ?? moduleId,
    workerCount,
    state: state.state,
    investigationTarget: state.investigationTarget,
    score,
    calibrating,
    calibratingReason,
    stats,
  }
}

export async function buildAllModuleCards(opts?: {
  liveScore?: boolean
}): Promise<{
  modules: ModuleCardView[]
  overallHealth: { score: number | null; calibrating: boolean }
}> {
  const modules: ModuleCardView[] = []
  for (const def of INTELLIGENCE_MODULES) {
    modules.push(await buildModuleCard(def.id, opts))
  }
  const overallHealth = computeOverallSystemHealth(
    modules.map((m) => ({ score: m.score, calibrating: m.calibrating })),
  )
  return { modules, overallHealth }
}
