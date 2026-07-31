import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redis } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REDIS_PREFIX = 'ccai:exec:desk-audit:'
const TTL_SEC = 60 * 60 * 24 * 30 // 30 days

type DeskAuditBody = {
  builder?: unknown
  securityVerdict?: string
  securityRiskScore?: number
  decisionSnapshot?: unknown
  signature?: string
  executionState?: string
  at?: string
}

/**
 * POST /api/execution/desk-audit
 * Persist Execution Desk audit (builder state + security gate + optional AI snapshot).
 * Soft-fails storage errors — never blocks the client lifecycle.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const body = (await req.json().catch(() => ({}))) as DeskAuditBody
  if (!body?.builder || typeof body.executionState !== 'string') {
    return NextResponse.json({ error: 'builder and executionState required' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const record = {
    id,
    userId: user?.id ?? null,
    builder: body.builder,
    securityVerdict: body.securityVerdict ?? 'UNKNOWN',
    securityRiskScore:
      typeof body.securityRiskScore === 'number' ? body.securityRiskScore : null,
    decisionSnapshot: body.decisionSnapshot ?? null,
    signature: typeof body.signature === 'string' ? body.signature : null,
    executionState: body.executionState,
    at: typeof body.at === 'string' ? body.at : new Date().toISOString(),
  }

  try {
    await redis.setex(`${REDIS_PREFIX}${id}`, TTL_SEC, JSON.stringify(record))
  } catch (e) {
    console.warn(
      '[desk-audit] redis',
      e instanceof Error ? e.message : e,
    )
  }

  return NextResponse.json(
    { ok: true, id },
    { headers: { 'cache-control': 'no-store' } },
  )
}
