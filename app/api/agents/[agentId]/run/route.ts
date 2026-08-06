/**
 * POST /api/agents/[agentId]/run
 * Orchestrates a single AI Employee action — live context + OpenAI (server-only).
 * Chat streams; report/analysis/signals/optimize return AgentRunStructured JSON.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { buildAgentLiveContext } from '@/lib/agents/context'
import { AGENT_OPENAI_MODEL, getOpenAiApiKey, isOpenAiConfigured } from '@/lib/agents/llm'
import { runStructuredEmployee } from '@/lib/agents/run-structured'
import {
  logAgentActivity,
  resolveEmployee,
  updateAgentActivityStatus,
} from '@/lib/agents/store'
import { statusCopyForAgentRun } from '@/lib/intelligence/copy'
import type { AgentRunRequest } from '@/types/agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteCtx = { params: { agentId: string } }

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

  const effectiveAction = employee.builtin ? employee.actionType : body.action || employee.actionType

  const message =
    body.message?.trim() ||
    (effectiveAction === 'chat'
      ? ''
      : `Run your primary ${effectiveAction} action using LIVE CONTEXT.`)

  if (effectiveAction === 'chat' && !message) {
    return NextResponse.json({ error: 'message required for chat' }, { status: 400 })
  }

  if (effectiveAction === 'chat') {
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

    const activityId = await logAgentActivity({
      agentId: employee.id,
      agentName: employee.name,
      kind: 'chat',
      description: statusCopyForAgentRun(employee.id, 'running'),
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
    const result = streamText({
      model,
      system: employee.systemPromptTemplate,
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

  const run = await runStructuredEmployee({
    agentId: employee.id,
    walletAddress: body.walletAddress,
    mint: body.mint,
    message,
    action: body.action,
    source: automationRun ? 'automation' : 'manual',
  })

  if (!run.ok) {
    return NextResponse.json({ error: run.error }, { status: run.status })
  }

  return NextResponse.json({
    agentId: run.agentId,
    action: run.action,
    result: run.result,
    fetchedAt: run.fetchedAt,
    activityId: run.activityId,
  })
}
