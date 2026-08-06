/**
 * GET  /api/automation/schedules — list schedules for SIWS user
 * POST /api/automation/schedules — enable/disable a recipe schedule (Pro)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAutomationRecipe, AUTOMATION_RECIPES } from '@/lib/portfolio-desk/automation-recipes'
import {
  listSchedulesForUser,
  upsertSchedule,
} from '@/lib/automation/schedules-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { resolveIdentityWithLookup } = await import('@/lib/identity/resolve')
  const identity = await resolveIdentityWithLookup(req)
  if (!identity.userId) {
    return NextResponse.json({
      schedules: [],
      recipes: AUTOMATION_RECIPES,
      authenticated: false,
    })
  }
  const schedules = await listSchedulesForUser(identity.userId)
  return NextResponse.json({
    schedules,
    recipes: AUTOMATION_RECIPES,
    authenticated: identity.authenticated,
    userId: identity.userId,
  })
}

export async function POST(req: NextRequest) {
  const { resolveIdentityWithLookup } = await import('@/lib/identity/resolve')
  const { isEntitled, entitlementDeniedBody } = await import('@/lib/identity/entitlements')
  const identity = await resolveIdentityWithLookup(req)

  let body: { recipeId?: string; enabled?: boolean; intervalMinutes?: number }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const recipeId = (body.recipeId || '').trim()
  const recipe = getAutomationRecipe(recipeId)
  if (!recipe) {
    return NextResponse.json({ error: 'unknown recipe' }, { status: 400 })
  }

  if (!identity.userId) {
    return NextResponse.json(
      { error: 'Sign in with Solana required to schedule automation.' },
      { status: 401 },
    )
  }

  if (!(await isEntitled(identity.userId, 'automation'))) {
    return NextResponse.json(entitlementDeniedBody('automation'), { status: 402 })
  }

  const enabled = body.enabled !== false
  const row = await upsertSchedule({
    userId: identity.userId,
    walletAddress: identity.walletAddress,
    recipeId: recipe.id,
    enabled,
    intervalMinutes: body.intervalMinutes,
  })

  if (!row) {
    return NextResponse.json({ error: 'schedule persist failed' }, { status: 500 })
  }

  return NextResponse.json({
    schedule: row,
    note: enabled
      ? `Next run ~${recipe.intervalMinutes}m — cron executes the real agent (no auto-swap).`
      : 'Schedule disabled.',
  })
}
