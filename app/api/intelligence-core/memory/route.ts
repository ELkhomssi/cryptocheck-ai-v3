/**
 * POST /api/intelligence-core/memory — append user_memory (SIWS user_id).
 * GET  /api/intelligence-core/memory — list + aggregates for session user.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  aggregateUserMemory,
  listUserMemory,
  recordUserMemory,
} from '@/lib/intelligence-core/memory-engine'
import type { UserMemoryActionType } from '@/types/intelligence-core'
import { resolveIdentityWithLookup } from '@/lib/identity/resolve'
import { enforceIdentityRateLimit } from '@/lib/identity/rate-limit'

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
  const identity = await resolveIdentityWithLookup(req)
  if (!identity.authenticated || !identity.userId) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 })
  }
  const userId = identity.userId
  const limited = await enforceIdentityRateLimit({
    userId,
    walletAddress: identity.walletAddress,
    route: 'memory',
  })
  if (!limited.ok) return limited.response

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

  const identity = await resolveIdentityWithLookup(req)
  if (!identity.authenticated || !identity.userId) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 })
  }
  if (body.userId && body.userId.trim() !== identity.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const userId = identity.userId

  const limited = await enforceIdentityRateLimit({
    userId,
    walletAddress: identity.walletAddress,
    route: 'memory-write',
  })
  if (!limited.ok) return limited.response

  const actionType = body.actionType as UserMemoryActionType
  if (!ACTIONS.has(actionType)) {
    return NextResponse.json({ error: 'valid actionType required' }, { status: 400 })
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
