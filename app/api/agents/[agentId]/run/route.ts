/**
 * POST /api/agents/[agentId]/run
 * Orchestrates a single AI Employee action — live context + Anthropic (server-only).
 * Chat streams; report/analysis/signals/optimize return AgentRunStructured JSON.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { buildAgentLiveContext } from '@/lib/agents/context'
import { parseStructuredAgentOutput } from '@/lib/agents/parse-structured'
import {
  insertPrediction,
  logAgentActivity,
  resolveEmployee,
  updateAgentActivityStatus,
} from '@/lib/agents/store'
import type { AgentRunRequest, AgentRunStructured } from '@/types/agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteCtx = { params: { agentId: string } }

function completenessFromStructured(out: AgentRunStructured): number {
  let filled = 0
  let total = 4
  if (out.summary?.trim()) filled += 1
  if (out.sections?.length) filled += 1
  if (out.stats?.length) filled += 1
  if (out.signals?.length || out.suggestions?.length) filled += 1
  return Math.round((filled / total) * 100)
}

async function maybeLogPredictions(
  agentId: string,
  formulaId: string,
  structured: AgentRunStructured,
  windowHours: number,
): Promise<void> {
  const resolveAfter = new Date(Date.now() + windowHours * 3_600_000)
  if (formulaId === 'setup_win_rate' || formulaId === 'whale_followthrough') {
    for (const sig of structured.signals ?? []) {
      if (!sig.mint) continue
      await insertPrediction({
        agentId,
        kind: formulaId === 'whale_followthrough' ? 'whale_buy' : 'setup',
        subject: sig.mint,
        payload: {
          mint: sig.mint,
          symbol: sig.symbol,
          note: sig.note,
          direction: 'up',
        },
        resolveAfter,
      })
    }
  }
  if (formulaId === 'outlook_directional_accuracy') {
    const bias = structured.summary.toLowerCase()
    const direction = bias.includes('bear') ? 'down' : bias.includes('bull') ? 'up' : null
    if (direction) {
      await insertPrediction({
        agentId,
        kind: 'outlook',
        subject: 'SOL',
        payload: {
          mint: 'So11111111111111111111111111111111111111112',
          direction,
          summary: structured.summary.slice(0, 400),
        },
        resolveAfter,
      })
    }
  }
  if (formulaId === 'launch_approval_safety') {
    for (const sig of structured.signals ?? []) {
      if (!sig.mint) continue
      const severity = (sig.severity || '').toLowerCase()
      if (severity.includes('danger') || severity.includes('avoid')) continue
      await insertPrediction({
        agentId,
        kind: 'launch_approval',
        subject: sig.mint,
        payload: { mint: sig.mint, symbol: sig.symbol, note: sig.note, direction: 'up' },
        resolveAfter,
      })
    }
  }
}

/**
 * GET — availability probe (no secrets).
 */
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const agentId = decodeURIComponent(ctx.params.agentId)
  const employee = await resolveEmployee(agentId)
  return NextResponse.json({
    available: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    agentId: employee?.id ?? null,
    found: Boolean(employee),
  })
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const agentId = decodeURIComponent(ctx.params.agentId)
  const employee = await resolveEmployee(agentId)
  if (!employee) {
    return NextResponse.json({ error: 'unknown agent' }, { status: 404 })
  }

  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const { acquireProviderQuota } = await import('@/lib/providers/quota')
  const quota = await acquireProviderQuota('anthropic')
  if (quota.ok === false) {
    return NextResponse.json(
      {
        error: 'AI Employees temporarily rate-limited. Try again shortly.',
        reason: quota.reason,
        retryAfterMs: quota.retryAfterMs,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(quota.retryAfterMs / 1000)) },
      },
    )
  }

  let body: AgentRunRequest
  try {
    body = (await req.json()) as AgentRunRequest
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const action = body.action || employee.actionType
  if (action !== employee.actionType && employee.builtin) {
    // Allow chat-style follow-ups only when employee is chat-typed; otherwise force declared action.
    if (!(employee.actionType === 'chat' && action === 'chat')) {
      /* keep requested action for custom flexibility; built-ins stick to declared type */
    }
  }
  const effectiveAction = employee.builtin ? employee.actionType : action

  const message =
    body.message?.trim() ||
    (effectiveAction === 'chat'
      ? ''
      : `Run your primary ${effectiveAction} action using LIVE CONTEXT.`)

  if (effectiveAction === 'chat' && !message) {
    return NextResponse.json({ error: 'message required for chat' }, { status: 400 })
  }

  const activityId = await logAgentActivity({
    agentId: employee.id,
    agentName: employee.name,
    kind: effectiveAction === 'chat' ? 'chat' : effectiveAction,
    description:
      effectiveAction === 'chat'
        ? `Chat: ${message.slice(0, 120)}`
        : `Started ${employee.actionLabel}`,
    walletAddress: body.walletAddress ?? null,
    status: 'running',
  })

  // ~50–800ms estimated
  const liveContext = await buildAgentLiveContext({
    dataSources: employee.dataSources,
    walletAddress: body.walletAddress,
    mint: body.mint,
    message,
  })

  const anthropic = createAnthropic({ apiKey: key })
  const system = employee.systemPromptTemplate

  if (effectiveAction === 'chat') {
    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      system,
      messages: [
        {
          role: 'user',
          content: `${liveContext}\n\nUSER MESSAGE:\n${message}`,
        },
      ],
    })

    // Mark completed asynchronously after stream starts (best-effort).
    if (activityId) {
      void updateAgentActivityStatus(activityId, 'completed', { streamed: true })
    }

    return result.toTextStreamResponse()
  }

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system,
      prompt: [
        liveContext,
        '',
        `ACTION: ${effectiveAction}`,
        'Respond with a single JSON object matching the schema described in your instructions.',
        'Do not wrap in markdown unless necessary.',
        message ? `USER NOTE:\n${message}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    })

    const structured = parseStructuredAgentOutput(result.text)
    const completeness = completenessFromStructured(structured)

    let coveragePct: number | undefined
    if (employee.performanceFormula.id === 'portfolio_coverage' && body.walletAddress) {
      coveragePct = 100
    }

    if (activityId) {
      await updateAgentActivityStatus(activityId, 'completed', {
        completeness,
        coveragePct,
        title: structured.title,
      })
    } else {
      await logAgentActivity({
        agentId: employee.id,
        agentName: employee.name,
        kind: effectiveAction,
        description: `${employee.actionLabel}: ${structured.title}`,
        walletAddress: body.walletAddress ?? null,
        status: 'completed',
        meta: { completeness, coveragePct },
      })
    }

    await maybeLogPredictions(
      employee.id,
      employee.performanceFormula.id,
      structured,
      employee.performanceFormula.verificationWindowHours,
    )

    // Enrich optimize suggestions with stable ids if missing
    if (structured.suggestions?.length) {
      structured.suggestions = structured.suggestions.map((s, i) => ({
        ...s,
        id: s.id || `opt-${i + 1}`,
      }))
    }

    return NextResponse.json({
      agentId: employee.id,
      action: effectiveAction,
      result: structured,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    if (activityId) {
      await updateAgentActivityStatus(activityId, 'failed', {
        error: e instanceof Error ? e.message : 'run failed',
      })
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'agent run failed' },
      { status: 500 },
    )
  }
}
