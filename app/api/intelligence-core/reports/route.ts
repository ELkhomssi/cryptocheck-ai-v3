/**
 * GET  /api/intelligence-core/reports?type=morning_brief
 * POST /api/intelligence-core/reports — generate + persist
 * Phase 18: daily/weekly/monthly generation requires Pro (scheduled_reports).
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateReport, getLatestReport } from '@/lib/intelligence-core/report-engine'
import type { ReportType } from '@/types/intelligence-core'
import { resolveIdentityWithLookup } from '@/lib/identity/resolve'
import { enforceIdentityRateLimit } from '@/lib/identity/rate-limit'
import { entitlementDeniedBody, isEntitled } from '@/lib/identity/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TYPES = new Set<ReportType>(['morning_brief', 'daily', 'weekly', 'monthly'])
const PRO_REPORTS = new Set<ReportType>(['daily', 'weekly', 'monthly'])

export async function GET(req: NextRequest) {
  const identity = await resolveIdentityWithLookup(req)
  const limited = await enforceIdentityRateLimit({
    userId: identity.userId,
    walletAddress: identity.walletAddress,
    route: 'reports-get',
  })
  if (!limited.ok) return limited.response

  const type = (req.nextUrl.searchParams.get('type') || 'morning_brief') as ReportType
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }
  const report = await getLatestReport(type, identity.walletAddress)
  return NextResponse.json({ report })
}

export async function POST(req: NextRequest) {
  let body: { reportType?: string; walletAddress?: string; userId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const identity = await resolveIdentityWithLookup(req)
  const limited = await enforceIdentityRateLimit({
    userId: identity.userId,
    walletAddress: identity.walletAddress,
    route: 'reports-post',
  })
  if (!limited.ok) return limited.response

  const reportType = (body.reportType || 'morning_brief') as ReportType
  if (!TYPES.has(reportType)) {
    return NextResponse.json({ error: 'invalid reportType' }, { status: 400 })
  }

  if (PRO_REPORTS.has(reportType)) {
    const userId = identity.userId
    if (!userId || !(await isEntitled(userId, 'scheduled_reports'))) {
      return NextResponse.json(entitlementDeniedBody('scheduled_reports'), { status: 402 })
    }
  }

  const report = await generateReport({
    reportType,
    walletAddress: identity.walletAddress ?? body.walletAddress ?? null,
    userId: identity.userId ?? body.userId ?? null,
  })
  return NextResponse.json({ report })
}
