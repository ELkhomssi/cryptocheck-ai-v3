/**
 * GET|POST /api/cron/intelligence-memory
 * Auth: Bearer CRON_SECRET
 * Daily: Yesterday / Today / Tomorrow memory loop per module.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runAllModuleMemoryJobs } from '@/lib/intelligence/memory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const results = await runAllModuleMemoryJobs()
    return NextResponse.json({
      ok: true,
      results,
      at: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'intelligence-memory failed' },
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
