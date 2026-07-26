/**
 * Phase 16.4 — Yesterday / Today / Tomorrow module memory loop.
 * Grounded in real agent_activity / agent_predictions — never fabricated discoveries.
 */

import { AGENT_OPENAI_MODEL, getOpenAiApiKey } from '@/lib/agents/llm'
import { insertPrediction } from '@/lib/agents/store'
import { getModuleDef, workerIdsForModule } from '@/lib/intelligence/modules'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { IntelligenceModuleId, ModuleMemorySlot } from '@/types/intelligence'

const IDLE_YESTERDAY =
  'No notable discoveries logged yesterday — the feed stays quiet until real activity arrives.'

type NotableEntry = {
  id: string
  source: 'activity' | 'prediction'
  text: string
  severity: number
  createdAt: string
}

function severityOf(meta: Record<string, unknown> | null, kind: string): number {
  if (!meta) return kind === 'signals' ? 40 : 20
  const s = meta.severity ?? meta.confidence ?? meta.riskScore
  if (typeof s === 'number' && Number.isFinite(s)) return s
  if (typeof s === 'string') {
    const map: Record<string, number> = {
      critical: 95,
      high: 80,
      medium: 50,
      low: 20,
      info: 10,
    }
    return map[s.toLowerCase()] ?? 30
  }
  return 30
}

function yesterdayWindow(): { start: string; end: string } {
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function findNotableYesterday(
  moduleId: IntelligenceModuleId,
): Promise<NotableEntry | null> {
  const workers = workerIdsForModule(moduleId)
  if (!workers.length) return null
  const { start, end } = yesterdayWindow()
  const candidates: NotableEntry[] = []

  try {
    const admin = getSupabaseAdmin()
    const { data: acts } = await admin
      .from('agent_activity')
      .select('id, kind, description, meta, created_at, status')
      .in('agent_id', workers)
      .eq('status', 'completed')
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(100)

    for (const row of acts ?? []) {
      const desc = String(row.description ?? '').trim()
      if (!desc) continue
      candidates.push({
        id: String(row.id),
        source: 'activity',
        text: desc,
        severity: severityOf((row.meta as Record<string, unknown>) ?? null, String(row.kind)),
        createdAt: String(row.created_at),
      })
    }

    const { data: preds } = await admin
      .from('agent_predictions')
      .select('id, kind, subject, payload, status, created_at')
      .in('agent_id', workers)
      .in('status', ['correct', 'incorrect', 'expired'])
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(100)

    for (const row of preds ?? []) {
      const payload = (row.payload as Record<string, unknown>) ?? {}
      const text =
        (typeof payload.summary === 'string' && payload.summary) ||
        (typeof payload.note === 'string' && payload.note) ||
        (typeof row.subject === 'string' && row.subject) ||
        `${row.kind} ${row.status}`
      const conf =
        typeof payload.confidence === 'number'
          ? payload.confidence
          : row.status === 'correct'
            ? 70
            : 40
      candidates.push({
        id: String(row.id),
        source: 'prediction',
        text: String(text),
        severity: conf,
        createdAt: String(row.created_at),
      })
    }
  } catch (e) {
    console.error('[intelligence] findNotableYesterday', e)
    return null
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.severity - a.severity || Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return candidates[0] ?? null
}

async function modelUpdate(params: {
  moduleName: string
  yesterday: string
  mode: 'today' | 'tomorrow'
}): Promise<string | null> {
  const key = getOpenAiApiKey()
  if (!key) return null
  const system =
    params.mode === 'today'
      ? `You write a single short institutional update for ${params.moduleName}. Reference yesterday's logged item explicitly (confirmed, changed, or unresolved). Impersonal phrasing only — never "Agent says". Max 2 sentences.`
      : `You write a single short forward-looking expectation for ${params.moduleName} grounded in yesterday's item. Impersonal phrasing only. Max 2 sentences. This will be stored as a resolvable prediction.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AGENT_OPENAI_MODEL,
        temperature: 0.3,
        max_tokens: 180,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Yesterday's logged entry:\n${params.yesterday}`,
          },
        ],
      }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = body.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch {
    return null
  }
}

export type MemoryJobResult = {
  moduleId: IntelligenceModuleId
  yesterdayIdle: boolean
  todayText: string | null
  predictionId: string | null
}

/**
 * Daily job per module: resolve yesterday notable → today update → tomorrow prediction row.
 */
export async function runModuleMemoryJob(
  moduleId: IntelligenceModuleId,
): Promise<MemoryJobResult> {
  const def = getModuleDef(moduleId)
  const notable = await findNotableYesterday(moduleId)

  if (!notable) {
    await upsertMemoryRow(moduleId, {
      yesterday: IDLE_YESTERDAY,
      yesterdayIdle: true,
      today: IDLE_YESTERDAY,
      todayIdle: true,
      tomorrow: null,
      tomorrowPredictionId: null,
    })
    return {
      moduleId,
      yesterdayIdle: true,
      todayText: null,
      predictionId: null,
    }
  }

  const today =
    (await modelUpdate({
      moduleName: def?.displayName ?? moduleId,
      yesterday: notable.text,
      mode: 'today',
    })) ||
    `Update referencing yesterday: ${notable.text.slice(0, 200)} — status unresolved pending fresh data.`

  const tomorrow =
    (await modelUpdate({
      moduleName: def?.displayName ?? moduleId,
      yesterday: notable.text,
      mode: 'tomorrow',
    })) || `Expect follow-through on: ${notable.text.slice(0, 160)}`

  const workers = workerIdsForModule(moduleId)
  const agentId = workers[0] ?? `module:${moduleId}`
  const resolveAfter = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await insertPrediction({
    agentId,
    kind: 'module_memory_tomorrow',
    subject: moduleId,
    payload: {
      moduleId,
      expectation: tomorrow,
      yesterdayRef: notable.text,
      yesterdaySourceId: notable.id,
      statusNote: 'pending',
    },
    resolveAfter,
  })

  // Best-effort: fetch the prediction we just inserted for the id
  let predictionId: string | null = null
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('agent_predictions')
      .select('id')
      .eq('agent_id', agentId)
      .eq('kind', 'module_memory_tomorrow')
      .eq('subject', moduleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    predictionId = data?.id ? String(data.id) : null
  } catch {
    predictionId = null
  }

  await upsertMemoryRow(moduleId, {
    yesterday: notable.text,
    yesterdayIdle: false,
    yesterdaySourceId: notable.id,
    today,
    todayIdle: false,
    tomorrow,
    tomorrowPredictionId: predictionId,
  })

  return {
    moduleId,
    yesterdayIdle: false,
    todayText: today,
    predictionId,
  }
}

async function upsertMemoryRow(
  moduleId: IntelligenceModuleId,
  slots: {
    yesterday: string
    yesterdayIdle: boolean
    yesterdaySourceId?: string
    today: string
    todayIdle: boolean
    tomorrow: string | null
    tomorrowPredictionId: string | null
  },
): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    const day = new Date().toISOString().slice(0, 10)
    await admin.from('intelligence_module_memory').upsert(
      {
        module_id: moduleId,
        memory_day: day,
        yesterday_text: slots.yesterday,
        yesterday_idle: slots.yesterdayIdle,
        yesterday_source_id: slots.yesterdaySourceId ?? null,
        today_text: slots.today,
        today_idle: slots.todayIdle,
        tomorrow_text: slots.tomorrow,
        tomorrow_prediction_id: slots.tomorrowPredictionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'module_id,memory_day' },
    )
  } catch (e) {
    console.error('[intelligence] upsertMemoryRow', e)
  }
}

export async function getModuleMemory(
  moduleId: IntelligenceModuleId,
): Promise<ModuleMemorySlot[]> {
  try {
    const admin = getSupabaseAdmin()
    const day = new Date().toISOString().slice(0, 10)
    const { data } = await admin
      .from('intelligence_module_memory')
      .select('*')
      .eq('module_id', moduleId)
      .eq('memory_day', day)
      .maybeSingle()

    if (!data) {
      return [
        { label: 'Yesterday', text: IDLE_YESTERDAY, idle: true },
        {
          label: 'Today',
          text: 'No memory cycle yet today — waiting for the daily job.',
          idle: true,
        },
        {
          label: 'Tomorrow',
          text: 'No forward expectation stored yet.',
          idle: true,
        },
      ]
    }

    return [
      {
        label: 'Yesterday',
        text: String(data.yesterday_text ?? IDLE_YESTERDAY),
        idle: data.yesterday_idle !== false,
        sourceId: (data.yesterday_source_id as string | null) ?? null,
      },
      {
        label: 'Today',
        text: String(data.today_text ?? ''),
        idle: data.today_idle === true,
      },
      {
        label: 'Tomorrow',
        text: String(data.tomorrow_text ?? 'No forward expectation stored yet.'),
        idle: !data.tomorrow_text,
        predictionId: (data.tomorrow_prediction_id as string | null) ?? null,
      },
    ]
  } catch {
    return [
      { label: 'Yesterday', text: IDLE_YESTERDAY, idle: true },
      { label: 'Today', text: 'Memory store unavailable.', idle: true },
      { label: 'Tomorrow', text: 'Memory store unavailable.', idle: true },
    ]
  }
}

export async function runAllModuleMemoryJobs(): Promise<MemoryJobResult[]> {
  const ids: IntelligenceModuleId[] = [
    'market',
    'security',
    'trading',
    'portfolio',
    'launch',
    'research',
  ]
  const out: MemoryJobResult[] = []
  for (const id of ids) {
    out.push(await runModuleMemoryJob(id))
  }
  return out
}
