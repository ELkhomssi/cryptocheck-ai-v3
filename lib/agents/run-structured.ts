/**
 * Shared structured AI Employee runner (non-chat).
 * Used by POST /api/agents/[id]/run and the automation cron.
 * Presentation/API layers stay thin — this owns the live-context → LLM → activity path.
 */

import 'server-only'

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { buildAgentLiveContext } from '@/lib/agents/context'
import { AGENT_OPENAI_MODEL, getOpenAiApiKey } from '@/lib/agents/llm'
import { parseStructuredAgentOutput } from '@/lib/agents/parse-structured'
import {
  insertPrediction,
  logAgentActivity,
  resolveEmployee,
  updateAgentActivityStatus,
} from '@/lib/agents/store'
import { statusCopyForAgentRun } from '@/lib/intelligence/copy'
import type { AgentRunStructured } from '@/types/agents'

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

export type RunStructuredEmployeeParams = {
  agentId: string
  walletAddress?: string | null
  mint?: string | null
  message?: string | null
  /** Overrides employee.actionType when provided (custom employees). */
  action?: string | null
  source?: string
}

export type RunStructuredEmployeeResult =
  | {
      ok: true
      agentId: string
      action: string
      activityId: string | null
      result: AgentRunStructured
      fetchedAt: string
    }
  | {
      ok: false
      error: string
      status: number
      activityId?: string | null
    }

export async function runStructuredEmployee(
  params: RunStructuredEmployeeParams,
): Promise<RunStructuredEmployeeResult> {
  const employee = await resolveEmployee(params.agentId)
  if (!employee) {
    return { ok: false, error: 'unknown agent', status: 404 }
  }

  const key = getOpenAiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'OPENAI_API_KEY is not configured on the server.',
      status: 503,
    }
  }

  const { acquireProviderQuota } = await import('@/lib/providers/quota')
  const quota = await acquireProviderQuota('openai')
  if (quota.ok === false) {
    return {
      ok: false,
      error: 'AI Employees temporarily rate-limited. Try again shortly.',
      status: 429,
    }
  }

  const effectiveAction = employee.builtin
    ? employee.actionType
    : params.action || employee.actionType

  if (effectiveAction === 'chat') {
    return { ok: false, error: 'use streaming chat path for chat actions', status: 400 }
  }

  const message =
    params.message?.trim() ||
    `Run your primary ${effectiveAction} action using LIVE CONTEXT.`

  const activityId = await logAgentActivity({
    agentId: employee.id,
    agentName: employee.name,
    kind: effectiveAction,
    description: statusCopyForAgentRun(employee.id, 'started'),
    walletAddress: params.walletAddress ?? null,
    status: 'running',
    meta: {
      ...(params.mint ? { targetMint: params.mint } : {}),
      ...(params.source ? { source: params.source } : {}),
    },
  })

  // ~50–800ms estimated for context gather
  const liveContext = await buildAgentLiveContext({
    dataSources: employee.dataSources,
    walletAddress: params.walletAddress ?? undefined,
    mint: params.mint ?? undefined,
    message,
  })

  const openai = createOpenAI({ apiKey: key })
  const model = openai(AGENT_OPENAI_MODEL)
  const system = employee.systemPromptTemplate

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
    if (employee.performanceFormula.id === 'portfolio_coverage' && params.walletAddress) {
      coveragePct = 100
    }

    if (activityId) {
      await updateAgentActivityStatus(activityId, 'completed', {
        completeness,
        coveragePct,
        title: structured.title,
        source: params.source,
      })
    } else {
      await logAgentActivity({
        agentId: employee.id,
        agentName: employee.name,
        kind: effectiveAction,
        description: `${employee.actionLabel}: ${structured.title}`,
        walletAddress: params.walletAddress ?? null,
        status: 'completed',
        meta: { completeness, coveragePct, source: params.source },
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

    return {
      ok: true,
      agentId: employee.id,
      action: effectiveAction,
      activityId,
      result: structured,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    if (activityId) {
      await updateAgentActivityStatus(activityId, 'failed', {
        error: e instanceof Error ? e.message : 'run failed',
      })
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'agent run failed',
      status: 500,
      activityId,
    }
  }
}
