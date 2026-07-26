/**
 * Phase 16.3 — module state determination (exact, not vibes-based).
 *
 * Running       — ≥1 agent_activity row for module workers with status=running
 * Investigating — Running + meta marks a deep-dive with a named target
 * Waiting       — automation configured for module, nothing executing
 * Idle          — no automation configured and no active job
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { workerIdsForModule } from '@/lib/intelligence/modules'
import type {
  IntelligenceModuleId,
  IntelligenceModuleState,
} from '@/types/intelligence'

/** Recipes available in AutomationPanel mapped to modules (= automation configured). */
const MODULE_AUTOMATION_RECIPES: Record<IntelligenceModuleId, string[]> = {
  market: ['liquidity-watch', 'whale-monitor'],
  security: [],
  trading: [],
  portfolio: ['portfolio-audit'],
  launch: [],
  research: ['daily-outlook'],
}

export type ModuleStateResult = {
  state: IntelligenceModuleState
  investigationTarget: string | null
  runningCount: number
}

function targetFromMeta(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null
  const keys = ['investigationTarget', 'target', 'targetMint', 'mint', 'symbol', 'subject']
  for (const k of keys) {
    const v = meta[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  if (meta.investigation === true) return 'deep-dive'
  return null
}

export async function resolveModuleState(
  moduleId: IntelligenceModuleId,
): Promise<ModuleStateResult> {
  const workerIds = workerIdsForModule(moduleId)
  if (workerIds.length === 0) {
    return { state: 'idle', investigationTarget: null, runningCount: 0 }
  }

  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_activity')
      .select('id, agent_id, status, meta, description')
      .eq('status', 'running')
      .in('agent_id', workerIds)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data?.length) {
      for (const row of data) {
        const meta = (row.meta as Record<string, unknown> | null) ?? null
        const target = targetFromMeta(meta)
        if (target) {
          return {
            state: 'investigating',
            investigationTarget: target,
            runningCount: data.length,
          }
        }
      }
      return {
        state: 'running',
        investigationTarget: null,
        runningCount: data.length,
      }
    }
  } catch {
    /* fall through */
  }

  const automationConfigured =
    (MODULE_AUTOMATION_RECIPES[moduleId]?.length ?? 0) > 0 ||
    (await hasRecentScheduledActivity(moduleId, workerIds))

  if (automationConfigured) {
    return { state: 'waiting', investigationTarget: null, runningCount: 0 }
  }
  return { state: 'idle', investigationTarget: null, runningCount: 0 }
}

async function hasRecentScheduledActivity(
  _moduleId: IntelligenceModuleId,
  workerIds: string[],
): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await admin
      .from('agent_activity')
      .select('id, kind, meta')
      .in('agent_id', workerIds)
      .gte('created_at', since)
      .limit(50)
    if (error || !data?.length) return false
    return data.some((row) => {
      const kind = String(row.kind)
      if (kind === 'heartbeat') return true
      const meta = (row.meta as Record<string, unknown> | null) ?? null
      return Boolean(meta && (meta.scheduled === true || meta.automation === true))
    })
  } catch {
    return false
  }
}
