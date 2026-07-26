/**
 * Server-only persistence helpers for AI Employees (Phase 11).
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type {
  AgentActivityKind,
  AgentActivityRow,
  AgentPerformanceSnapshot,
  AIEmployee,
  AgentActionType,
  AgentDataSource,
  AgentIconTone,
} from '@/types/agents'
import { buildCustomSystemPrompt, getBuiltinEmployee, listBuiltinEmployees } from '@/lib/agents/roster'

function mapActivity(row: Record<string, unknown>): AgentActivityRow {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    agentName: String(row.agent_name),
    kind: row.kind as AgentActivityKind,
    description: String(row.description ?? ''),
    walletAddress: (row.wallet_address as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    status: row.status as AgentActivityRow['status'],
    createdAt: String(row.created_at),
  }
}

function mapSnapshot(row: Record<string, unknown>): AgentPerformanceSnapshot {
  const scoreRaw = row.score
  const score =
    scoreRaw == null || scoreRaw === ''
      ? null
      : typeof scoreRaw === 'number'
        ? scoreRaw
        : Number(scoreRaw)
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    score: Number.isFinite(score) ? score : null,
    sampleSize: Number(row.sample_size ?? 0) || 0,
    calibrating: row.calibrating !== false,
    computedAt: String(row.computed_at),
    meta: (row.meta as Record<string, unknown> | null) ?? null,
  }
}

export async function logAgentActivity(params: {
  agentId: string
  agentName: string
  kind: AgentActivityKind
  description: string
  walletAddress?: string | null
  userId?: string | null
  status?: AgentActivityRow['status']
  meta?: Record<string, unknown>
}): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_activity')
      .insert({
        agent_id: params.agentId,
        agent_name: params.agentName,
        kind: params.kind,
        description: params.description,
        wallet_address: params.walletAddress ?? null,
        user_id: params.userId ?? null,
        status: params.status ?? 'completed',
        meta: params.meta ?? {},
      })
      .select('id')
      .single()
    if (error) {
      console.error('[agents] logAgentActivity', error.message)
      return null
    }
    return data?.id ? String(data.id) : null
  } catch (e) {
    console.error('[agents] logAgentActivity unavailable', e)
    return null
  }
}

export async function updateAgentActivityStatus(
  id: string,
  status: AgentActivityRow['status'],
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    const patch: Record<string, unknown> = { status }
    if (meta) patch.meta = meta
    await admin.from('agent_activity').update(patch).eq('id', id)
  } catch (e) {
    console.error('[agents] updateAgentActivityStatus', e)
  }
}

export async function listAgentActivity(limit = 40): Promise<AgentActivityRow[]> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100))
    if (error || !data) return []
    return data.map((r) => mapActivity(r as Record<string, unknown>))
  } catch {
    return []
  }
}

/** Latest snapshot per agent_id (by computed_at). */
export async function latestPerformanceSnapshots(
  agentIds?: string[],
): Promise<Map<string, AgentPerformanceSnapshot>> {
  const out = new Map<string, AgentPerformanceSnapshot>()
  try {
    const admin = getSupabaseAdmin()
    let q = admin
      .from('agent_performance_snapshots')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(200)
    if (agentIds?.length) q = q.in('agent_id', agentIds)
    const { data, error } = await q
    if (error || !data) return out
    for (const row of data) {
      const snap = mapSnapshot(row as Record<string, unknown>)
      if (!out.has(snap.agentId)) out.set(snap.agentId, snap)
    }
  } catch {
    /* empty */
  }
  return out
}

export async function insertPrediction(params: {
  agentId: string
  kind: string
  subject?: string | null
  payload: Record<string, unknown>
  resolveAfter: Date
}): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    await admin.from('agent_predictions').insert({
      agent_id: params.agentId,
      kind: params.kind,
      subject: params.subject ?? null,
      payload: params.payload,
      status: 'pending',
      resolve_after: params.resolveAfter.toISOString(),
    })
  } catch (e) {
    console.error('[agents] insertPrediction', e)
  }
}

export async function writePerformanceSnapshot(params: {
  agentId: string
  score: number | null
  sampleSize: number
  calibrating: boolean
  meta?: Record<string, unknown>
}): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    await admin.from('agent_performance_snapshots').insert({
      agent_id: params.agentId,
      score: params.calibrating ? null : params.score,
      sample_size: params.sampleSize,
      calibrating: params.calibrating,
      meta: params.meta ?? {},
      computed_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[agents] writePerformanceSnapshot', e)
  }
}

export type CustomEmployeeRow = {
  id: string
  name: string
  role: string
  dataSources: AgentDataSource[]
  actionType: AgentActionType
  actionLabel: string
  instructions: string
  iconTone: AgentIconTone
  icon: string
  walletAddress: string | null
  userId: string | null
}

function mapCustom(row: Record<string, unknown>): CustomEmployeeRow {
  return {
    id: String(row.id),
    name: String(row.name),
    role: String(row.role),
    dataSources: Array.isArray(row.data_sources) ? (row.data_sources as AgentDataSource[]) : [],
    actionType: row.action_type as AgentActionType,
    actionLabel: String(row.action_label || 'Run'),
    instructions: String(row.instructions ?? ''),
    iconTone: (row.icon_tone as AgentIconTone) || 'accent',
    icon: String(row.icon || 'Bot'),
    walletAddress: (row.wallet_address as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
  }
}

export function customRowToEmployee(row: CustomEmployeeRow): AIEmployee {
  return {
    id: `custom:${row.id}`,
    name: row.name,
    role: row.role,
    dataSources: row.dataSources,
    actionType: row.actionType,
    actionLabel: row.actionLabel,
    systemPromptTemplate: buildCustomSystemPrompt(row.role, row.instructions),
    performanceFormula: {
      id: 'suggestion_acceptance',
      description: 'Calibrating until enough resolved activity accumulates.',
      minSamples: 10,
      verificationWindowHours: 24,
      recomputeCadence: 'daily',
    },
    iconTone: row.iconTone,
    icon: row.icon,
    builtin: false,
  }
}

export async function listCustomEmployees(walletAddress?: string | null): Promise<AIEmployee[]> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_custom_employees')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error || !data) return []
    const rows = data.map((r) => mapCustom(r as Record<string, unknown>))
    const filtered = walletAddress
      ? rows.filter((r) => !r.walletAddress || r.walletAddress === walletAddress)
      : rows
    return filtered.map(customRowToEmployee)
  } catch {
    return []
  }
}

export async function createCustomEmployee(input: {
  name: string
  role: string
  dataSources: AgentDataSource[]
  actionType: AgentActionType
  actionLabel?: string
  instructions: string
  walletAddress?: string | null
  userId?: string | null
}): Promise<AIEmployee | null> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_custom_employees')
      .insert({
        name: input.name.trim().slice(0, 64),
        role: input.role.trim().slice(0, 200),
        data_sources: input.dataSources,
        action_type: input.actionType,
        action_label:
          input.actionLabel ||
          (input.actionType === 'chat'
            ? 'Chat'
            : input.actionType === 'signals'
              ? 'View Signals'
              : 'View Report'),
        instructions: input.instructions.trim().slice(0, 4000),
        wallet_address: input.walletAddress ?? null,
        user_id: input.userId ?? null,
        icon_tone: 'accent',
        icon: 'Bot',
      })
      .select('*')
      .single()
    if (error || !data) {
      console.error('[agents] createCustomEmployee', error?.message)
      return null
    }
    return customRowToEmployee(mapCustom(data as Record<string, unknown>))
  } catch (e) {
    console.error('[agents] createCustomEmployee', e)
    return null
  }
}

export async function resolveEmployee(agentId: string): Promise<AIEmployee | null> {
  const builtin = getBuiltinEmployee(agentId)
  if (builtin) return builtin
  if (agentId.startsWith('custom:')) {
    const rawId = agentId.slice('custom:'.length)
    try {
      const admin = getSupabaseAdmin()
      const { data, error } = await admin.from('agent_custom_employees').select('*').eq('id', rawId).maybeSingle()
      if (error || !data) return null
      return customRowToEmployee(mapCustom(data as Record<string, unknown>))
    } catch {
      return null
    }
  }
  return null
}

export async function listAllEmployees(walletAddress?: string | null): Promise<AIEmployee[]> {
  const customs = await listCustomEmployees(walletAddress)
  return [...listBuiltinEmployees(), ...customs]
}

export async function countRunningTasks(): Promise<number> {
  try {
    const admin = getSupabaseAdmin()
    const { count, error } = await admin
      .from('agent_activity')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'running')
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function countActiveAgents(withinMinutes = 15): Promise<number> {
  try {
    const admin = getSupabaseAdmin()
    const since = new Date(Date.now() - withinMinutes * 60_000).toISOString()
    const { data, error } = await admin
      .from('agent_activity')
      .select('agent_id')
      .gte('created_at', since)
      .limit(500)
    if (error || !data) return 0
    return new Set(data.map((r) => String((r as { agent_id: string }).agent_id))).size
  } catch {
    return 0
  }
}

export async function countAgentAlertsToday(): Promise<number> {
  try {
    const admin = getSupabaseAdmin()
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    const { count, error } = await admin
      .from('portfolio_alerts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .in('type', [
        'whale_buy',
        'whale_sell',
        'smart_money_entry',
        'smart_money_exit',
        'rug_risk',
        'new_token_launch',
        'new_listing',
      ])
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function logSuggestionFeedback(params: {
  agentId: string
  suggestionId: string
  decision: 'accept' | 'dismiss'
  walletAddress?: string | null
}): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('agent_suggestion_feedback').insert({
      agent_id: params.agentId,
      suggestion_id: params.suggestionId,
      decision: params.decision,
      wallet_address: params.walletAddress ?? null,
    })
    return !error
  } catch {
    return false
  }
}
