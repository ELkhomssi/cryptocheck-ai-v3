import { NextRequest, NextResponse } from 'next/server'
import { processDueAutomationSchedules } from '@/lib/automation/process-schedules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET|POST /api/cron/automation-recipes
 * Auth: Bearer CRON_SECRET
 *
 * Runs due Pro Automation schedules via real AI Employees.
 * Never auto-swaps — activity/report/signals only.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDueAutomationSchedules(8)
    return NextResponse.json({
      ok: true,
      ...result,
      note: 'Agents produce activity only — no auto wallet signatures',
      at: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'automation cron failed' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
