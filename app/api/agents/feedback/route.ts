/**
 * POST /api/agents/feedback — Accept/Dismiss optimize suggestions (performance formula).
 */

import { NextRequest, NextResponse } from 'next/server'
import { logAgentActivity, logSuggestionFeedback } from '@/lib/agents/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: {
    agentId?: string
    suggestionId?: string
    decision?: 'accept' | 'dismiss'
    walletAddress?: string
    title?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.agentId || !body.suggestionId || (body.decision !== 'accept' && body.decision !== 'dismiss')) {
    return NextResponse.json({ error: 'agentId, suggestionId, decision required' }, { status: 400 })
  }

  const ok = await logSuggestionFeedback({
    agentId: body.agentId,
    suggestionId: body.suggestionId,
    decision: body.decision,
    walletAddress: body.walletAddress ?? null,
  })

  await logAgentActivity({
    agentId: body.agentId,
    agentName: 'Portfolio Manager',
    kind: 'optimize',
    description: `${body.decision === 'accept' ? 'Accepted' : 'Dismissed'} suggestion${
      body.title ? `: ${body.title}` : ` ${body.suggestionId}`
    }`,
    walletAddress: body.walletAddress ?? null,
    status: 'completed',
    meta: { suggestionId: body.suggestionId, decision: body.decision },
  })

  if (!ok) {
    return NextResponse.json(
      { error: 'Could not record feedback (check Supabase migration).' },
      { status: 503 },
    )
  }

  return NextResponse.json({ ok: true })
}
