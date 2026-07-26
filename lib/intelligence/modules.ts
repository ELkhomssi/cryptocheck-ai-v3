/**
 * Phase 16.1 — Intelligence Module registry.
 * Worker counts are always queried — never hardcoded in UI.
 *
 * "Active employee_instances" interpretation (no separate instances table yet):
 * count of built-in roster workers whose `modules` includes this module and who
 * are considered active for the module (News Intelligence excluded until its
 * provider is configured, per Phase 14 §3).
 */

import { listBuiltinEmployees, listEmployeesForModule } from '@/lib/agents/roster'
import type { AgentDataSource } from '@/types/agents'
import type { IntelligenceModuleId } from '@/types/intelligence'

export type IntelligenceModuleDef = {
  id: IntelligenceModuleId
  displayName: string
  /** Expected max age of last successful provider sync before freshness decays. */
  expectedSyncIntervalMs: number
  /** Data sources whose health feeds this module's uptime / freshness. */
  dataSources: AgentDataSource[]
}

export const INTELLIGENCE_MODULES: readonly IntelligenceModuleDef[] = [
  {
    id: 'market',
    displayName: 'Market Intelligence',
    expectedSyncIntervalMs: 5 * 60_000,
    dataSources: ['birdeye-screener', 'jupiter-price', 'helius-webhooks', 'portfolio-alerts'],
  },
  {
    id: 'security',
    displayName: 'Security Intelligence',
    expectedSyncIntervalMs: 15 * 60_000,
    dataSources: ['helius-metadata', 'birdeye-token'],
  },
  {
    id: 'trading',
    displayName: 'Trading Intelligence',
    expectedSyncIntervalMs: 2 * 60_000,
    dataSources: ['jupiter-price', 'birdeye-ohlcv', 'birdeye-screener'],
  },
  {
    id: 'portfolio',
    displayName: 'Portfolio Intelligence',
    expectedSyncIntervalMs: 10 * 60_000,
    dataSources: ['portfolio-analytics', 'jupiter-price'],
  },
  {
    id: 'launch',
    displayName: 'Launch Intelligence',
    expectedSyncIntervalMs: 15 * 60_000,
    dataSources: ['birdeye-new-listings', 'raydium-pools', 'helius-metadata', 'birdeye-token'],
  },
  {
    id: 'research',
    displayName: 'Research Intelligence',
    expectedSyncIntervalMs: 60 * 60_000,
    dataSources: ['birdeye-screener', 'jupiter-price', 'birdeye-token', 'news-sentiment'],
  },
] as const

export function getModuleDef(id: IntelligenceModuleId): IntelligenceModuleDef | undefined {
  return INTELLIGENCE_MODULES.find((m) => m.id === id)
}

export function isNewsProviderConfigured(): boolean {
  return Boolean(
    process.env.NEWS_API_KEY?.trim() ||
      process.env.CRYPTONEWS_API_KEY?.trim() ||
      process.env.NEWS_SENTIMENT_API_KEY?.trim(),
  )
}

/**
 * Whether a worker counts toward a module's active instance count.
 * News Intelligence stays hidden from Research until its provider is configured.
 */
export function isWorkerActiveForModule(
  employeeId: string,
  moduleId: IntelligenceModuleId,
): boolean {
  const emp = listBuiltinEmployees().find((e) => e.id === employeeId)
  if (!emp || !emp.modules.includes(moduleId)) return false
  if (emp.id === 'news-intelligence' && !isNewsProviderConfigured()) return false
  return true
}

/**
 * count(active employee_instances where module = X)
 * Must be called by every module card — never hardcode the result in UI.
 */
export async function countActiveWorkersForModule(
  moduleId: IntelligenceModuleId,
): Promise<number> {
  const workers = listEmployeesForModule(moduleId)
  return workers.filter((w) => isWorkerActiveForModule(w.id, moduleId)).length
}

/** Synchronous variant for pure unit tests / in-process scoring. */
export function countActiveWorkersForModuleSync(moduleId: IntelligenceModuleId): number {
  return listEmployeesForModule(moduleId).filter((w) => isWorkerActiveForModule(w.id, moduleId))
    .length
}

export function workerIdsForModule(moduleId: IntelligenceModuleId): string[] {
  return listEmployeesForModule(moduleId)
    .filter((w) => isWorkerActiveForModule(w.id, moduleId))
    .map((w) => w.id)
}

export function moduleIdForAgent(agentId: string): IntelligenceModuleId | null {
  const emp = listBuiltinEmployees().find((e) => e.id === agentId)
  if (!emp || emp.modules.length === 0) return null
  return emp.modules[0] ?? null
}

export function modulesForAgent(agentId: string): IntelligenceModuleId[] {
  const emp = listBuiltinEmployees().find((e) => e.id === agentId)
  return emp?.modules ?? []
}
