/**
 * Phase 16.8 — Command Center / status copy references Intelligence Modules,
 * never underlying employee names.
 */

import { getModuleDef, modulesForAgent } from '@/lib/intelligence/modules'
import type { IntelligenceModuleId } from '@/types/intelligence'

export function moduleDisplayName(id: IntelligenceModuleId): string {
  return getModuleDef(id)?.displayName ?? id
}

/** Status line while a routed request is executing. */
export function moduleRunningCopy(moduleId: IntelligenceModuleId): string {
  return `${moduleDisplayName(moduleId)} is running your query`
}

export function moduleStartedCopy(moduleId: IntelligenceModuleId, recipeTitle?: string): string {
  const name = moduleDisplayName(moduleId)
  if (recipeTitle) return `Started “${recipeTitle}” via ${name}`
  return `${name} started your request`
}

export function moduleCompletedCopy(moduleId: IntelligenceModuleId): string {
  return `${moduleDisplayName(moduleId)} completed the run`
}

/** Map an agent id → primary module for user-facing copy. */
export function primaryModuleForAgent(agentId: string): IntelligenceModuleId | null {
  const mods = modulesForAgent(agentId)
  return mods[0] ?? null
}

export function statusCopyForAgentRun(
  agentId: string,
  phase: 'running' | 'started' | 'completed',
  recipeTitle?: string,
): string {
  const mod = primaryModuleForAgent(agentId)
  if (!mod) {
    if (phase === 'running') return 'Intelligence is running your query'
    if (phase === 'started') return recipeTitle ? `Started “${recipeTitle}”` : 'Request started'
    return 'Run completed'
  }
  if (phase === 'running') return moduleRunningCopy(mod)
  if (phase === 'started') return moduleStartedCopy(mod, recipeTitle)
  return moduleCompletedCopy(mod)
}
