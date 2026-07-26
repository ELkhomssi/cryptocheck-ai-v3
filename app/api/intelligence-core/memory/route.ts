/**
 * POST /api/intelligence-core/memory — append user_memory interaction.
 * GET  /api/intelligence-core/memory?userId= — list + aggregates.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  aggregateUserMemory,
  listUserMemory,
  recordUserMemory,
} from '@/lib/intelligence-core/memory-engine'
import type { UserMemoryActionType } from '@/types/intelligence-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS = new Set<UserMemoryActionType>([
  'token_scanned',
  'token_ignored',
  'token_favorited',
  'wallet_tracked',
  'conversation_reference',
  'recommendation_shown',
  'alert_acknowledged',
])

export async function GET(req: NextRequest) {
  const userId = (req.nextUrl.searchParams.get('userId') || '').trim()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  const [entries, aggregates] = await Promise.all([
    listUserMemory(userId, 40),
    aggregateUserMemory(userId),
  ])
  return NextResponse.json({ entries, aggregates })
}

export async function POST(req: NextRequest) {
  let body: {
    userId?: string
    actionType?: string
    subjectType?: string
    subjectId?: string | null
    meta?: Record<string, unknown>
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const userId = body.userId?.trim()
  const actionType = body.actionType as UserMemoryActionType
  if (!userId || !ACTIONS.has(actionType)) {
    return NextResponse.json({ error: 'userId and valid actionType required' }, { status: 400 })
  }
  const id = await recordUserMemory({
    userId,
    actionType,
    subjectType: body.subjectType?.trim() || 'unknown',
    subjectId: body.subjectId ?? null,
    meta: body.meta,
  })
  return NextResponse.json({ id, ok: Boolean(id) })
}
