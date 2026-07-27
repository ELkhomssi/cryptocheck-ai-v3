/**
 * POST /api/agents/[agentId]/run
 * Orchestrates a single AI Employee action — live context + OpenAI (server-only).
 * Chat streams; report/analysis/signals/optimize return AgentRunStructured JSON.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { buildAgentLiveContext } from '@/lib/agents/context'
import { AGENT_OPENAI_MODEL, getOpenAiApiKey, isOpenAiConfigured } from '@/lib/agents/llm'
import { parseStructuredAgentOutput } from '@/lib/agents/parse-structured'
import {
  insertPrediction,
  logAgentActivity,
  resolveEmployee,
  updateAgentActivityStatus,
} from '@/lib/agents/store'
import { statusCopyForAgentRun } from '@/lib/intelligence/copy'
import type { AgentRunRequest, AgentRunStructured } from '@/types/agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteCtx = { params: { agentId: string } }

function completenessFromStructured(out: AgentRunStructured): number {
  let filled = 0
  const total = 4
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
  const { fetchPrices } = await import('@/lib/providers/jupiter')

  if (formulaId === 'setup_win_rate' || formulaId === 'whale_followthrough') {
    for (const sig of structured.signals ?? []) {
      if (!sig.mint) continue
      let entryPriceUsd: number | undefined
      try {
        const prices = await fetchPrices([sig.mint])
        entryPriceUsd = prices.get(sig.mint)?.priceUsd
      } catch {
        /* optional */
      }
      await insertPrediction({
        agentId,
        kind: formulaId === 'whale_followthrough' ? 'whale_buy' : 'setup',
        subject: sig.mint,
        payload: {
          mint: sig.mint,
          symbol: sig.symbol,
          note: sig.note,
          direction: 'up',
          entryPriceUsd,
        },
        resolveAfter,
      })
    }
  }
  if (formulaId === 'outlook_directional_accuracy') {
    const bias = structured.summary.toLowerCase()
    const direction = bias.includes('bear') ? 'down' : bias.includes('bull') ? 'up' : null
    if (direction) {
      const sol = 'So11111111111111111111111111111111111111112'
      let entryPriceUsd: number | undefined
      try {
        const prices = await fetchPrices([sol])
        entryPriceUsd = prices.get(sol)?.priceUsd
      } catch {
        /* optional */
      }
      await insertPrediction({
        agentId,
        kind: 'outlook',
        subject: 'SOL',
        payload: {
          mint: sol,
          direction,
          entryPriceUsd,
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
      let entryPriceUsd: number | undefined
      try {
        const prices = await fetchPrices([sig.mint])
        entryPriceUsd = prices.get(sig.mint)?.priceUsd
      } catch {
        /* optional */
      }
      await insertPrediction({
        agentId,
        kind: 'launch_approval',
        subject: sig.mint,
        payload: {
          mint: sig.mint,
          symbol: sig.symbol,
          note: sig.note,
          direction: 'up',
          entryPriceUsd,
        },
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
    available: isOpenAiConfigured(),
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

  const { resolveIdentityWithLookup } = await import('@/lib/identity/resolve')
  const { isEntitled, entitlementDeniedBody } = await import('@/lib/identity/entitlements')
  const identity = await resolveIdentityWithLookup(req)

  let body: AgentRunRequest
  try {
    body = (await req.json()) as AgentRunRequest
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Phase 18 — Automation schedule/recipe runs are Pro-gated (interactive chat stays free).
  const automationRun =
    (body as { automation?: boolean; source?: string }).automation === true ||
    (body as { source?: string }).source === 'automation'
  if (automationRun) {
    if (!identity.userId || !(await isEntitled(identity.userId, 'automation'))) {
      return NextResponse.json(entitlementDeniedBody('automation'), { status: 402 })
    }
  }

  const key = getOpenAiApiKey()
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const { acquireProviderQuota } = await import('@/lib/providers/quota')
  const quota = await acquireProviderQuota('openai')
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

  const action = body.action || employee.actionType
  void action
  const effectiveAction = employee.builtin ? employee.actionType : body.action || employee.actionType

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
        ? statusCopyForAgentRun(employee.id, 'running')
        : statusCopyForAgentRun(employee.id, 'started'),
    walletAddress: body.walletAddress ?? null,
    status: 'running',
    meta: body.mint
      ? { targetMint: body.mint, investigation: Boolean(body.mint) }
      : {},
  })

  // ~50–800ms estimated
  const liveContext = await buildAgentLiveContext({
    dataSources: employee.dataSources,
    walletAddress: body.walletAddress,
    mint: body.mint,
    message,
  })

  const openai = createOpenAI({ apiKey: key })
  const model = openai(AGENT_OPENAI_MODEL)
  const system = employee.systemPromptTemplate

  if (effectiveAction === 'chat') {
    const result = streamText({
      model,
      system,
      messages: [
        {
          role: 'user',
          content: `${liveContext}\n\nUSER MESSAGE:\n${message}`,
        },
      ],
    })

    if (activityId) {
      void updateAgentActivityStatus(activityId, 'completed', { streamed: true })
    }

    return result.toTextStreamResponse()
  }

  try {
    const result = await generateText({
      model,
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
