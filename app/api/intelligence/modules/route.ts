/**
 * GET /api/intelligence/modules
 * Module cards payload: worker counts, states, stats, scores, overall health.
 * All numbers from real queries — never hardcoded.
 */

import { NextResponse } from 'next/server'
import { buildAllModuleCards } from '@/lib/intelligence/assemble'
import { INTEL_SCORE_THRESHOLDS } from '@/types/intelligence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  try {
    const { modules, overallHealth } = await buildAllModuleCards()
    return NextResponse.json({
      modules,
      overallHealth,
      thresholds: INTEL_SCORE_THRESHOLDS,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[intelligence/modules]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
