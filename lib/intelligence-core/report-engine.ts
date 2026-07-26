/**
 * Phase 17.5 — ReportEngine
 * Morning Brief / Daily / Weekly / Monthly from Timeline + Context only.
 * Honest "not enough activity" when below REPORT_MIN_EVENTS — never pad with filler.
 *
 * Grep findings (reuse):
 * - timeline_events (Phase 17) via TimelineEngine
 * - ContextEngine for portfolio grounding
 * - Does NOT reuse intelligence_module_memory (module Y/T/T is different)
 */

import 'server-only'

import { getCoachContext } from '@/lib/intelligence-core/context-engine'
import {
  countTimelineEventsInWindow,
  listTimelineEvents,
} from '@/lib/intelligence-core/timeline-engine'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  REPORT_MIN_EVENTS,
  type ReportRow,
  type ReportType,
} from '@/types/intelligence-core'

function windowFor(reportType: ReportType, now = new Date()): { start: Date; end: Date } {
  const end = now
  const start = new Date(now)
  switch (reportType) {
    case 'morning_brief':
      start.setUTCHours(0, 0, 0, 0)
      break
    case 'daily':
      start.setTime(end.getTime() - 24 * 60 * 60 * 1000)
      break
    case 'weekly':
      start.setTime(end.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'monthly':
      start.setTime(end.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }
  return { start, end }
}

function titleFor(reportType: ReportType): string {
  switch (reportType) {
    case 'morning_brief':
      return 'Morning Brief'
    case 'daily':
      return 'Daily Report'
    case 'weekly':
      return 'Weekly Report'
    case 'monthly':
      return 'Monthly Report'
  }
}

function mapReport(row: Record<string, unknown>): ReportRow {
  return {
    id: String(row.id),
    reportType: row.report_type as ReportType,
    userId: (row.user_id as string | null) ?? null,
    walletAddress: (row.wallet_address as string | null) ?? null,
    title: String(row.title),
    body: String(row.body),
    insufficientActivity: row.insufficient_activity === true,
    windowStart: String(row.window_start),
    windowEnd: String(row.window_end),
    eventCount: Number(row.event_count ?? 0) || 0,
    createdAt: String(row.created_at),
  }
}

export async function generateReport(params: {
  reportType: ReportType
  userId?: string | null
  walletAddress?: string | null
}): Promise<ReportRow> {
  const { start, end } = windowFor(params.reportType)
  const sinceIso = start.toISOString()
  const untilIso = end.toISOString()
  const min = REPORT_MIN_EVENTS[params.reportType]
  const eventCount = await countTimelineEventsInWindow(sinceIso, untilIso)
  const title = titleFor(params.reportType)

  let body: string
  let insufficientActivity = false

  if (eventCount < min) {
    insufficientActivity = true
    body = `Not enough activity yet to generate a ${title.toLowerCase()}. Need at least ${min} timeline events in the window (have ${eventCount}).`
  } else {
    const [events, coachCtx] = await Promise.all([
      listTimelineEvents({ limit: 40, sinceIso, untilIso }),
      params.walletAddress
        ? getCoachContext(params.walletAddress)
        : Promise.resolve(null),
    ])
    const lines = events.slice(0, 20).map((e) => `• ${e.summary}`)
    body = [
      `${title} — ${eventCount} events from ${sinceIso.slice(0, 16)} to ${untilIso.slice(0, 16)} UTC.`,
      coachCtx?.portfolioBlock
        ? `Portfolio snapshot:\n${coachCtx.portfolioBlock.split('\n').slice(0, 4).join('\n')}`
        : 'Portfolio snapshot: unavailable (no wallet).',
      '',
      'Notable timeline:',
      ...lines,
      '',
      'Not financial advice · DYOR.',
    ].join('\n')
  }

  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('reports')
      .insert({
        report_type: params.reportType,
        user_id: params.userId ?? null,
        wallet_address: params.walletAddress ?? null,
        title,
        body,
        insufficient_activity: insufficientActivity,
        window_start: sinceIso,
        window_end: untilIso,
        event_count: eventCount,
        meta: { minRequired: min },
      })
      .select('*')
      .single()
    if (!error && data) return mapReport(data as Record<string, unknown>)
  } catch (e) {
    console.error('[intelligence-core] generateReport persist', e)
  }

  // Fallback ephemeral row when DB unavailable (still honest).
  return {
    id: `ephemeral-${Date.now()}`,
    reportType: params.reportType,
    userId: params.userId ?? null,
    walletAddress: params.walletAddress ?? null,
    title,
    body,
    insufficientActivity,
    windowStart: sinceIso,
    windowEnd: untilIso,
    eventCount,
    createdAt: new Date().toISOString(),
  }
}

export async function getLatestReport(
  reportType: ReportType,
  walletAddress?: string | null,
): Promise<ReportRow | null> {
  try {
    const admin = getSupabaseAdmin()
    let q = admin
      .from('reports')
      .select('*')
      .eq('report_type', reportType)
      .order('created_at', { ascending: false })
      .limit(1)
    if (walletAddress) q = q.eq('wallet_address', walletAddress)
    const { data, error } = await q.maybeSingle()
    if (error || !data) return null
    return mapReport(data as Record<string, unknown>)
  } catch {
    return null
  }
}
