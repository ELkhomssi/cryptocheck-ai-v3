/**
 * GET  /api/intelligence-core/reports?type=morning_brief&wallet=
 * POST /api/intelligence-core/reports — generate + persist
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateReport, getLatestReport } from '@/lib/intelligence-core/report-engine'
import type { ReportType } from '@/types/intelligence-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TYPES = new Set<ReportType>(['morning_brief', 'daily', 'weekly', 'monthly'])

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') || 'morning_brief') as ReportType
  const wallet = (req.nextUrl.searchParams.get('wallet') || '').trim() || null
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }
  const report = await getLatestReport(type, wallet)
  return NextResponse.json({ report })
}

export async function POST(req: NextRequest) {
  let body: { reportType?: string; walletAddress?: string; userId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const reportType = (body.reportType || 'morning_brief') as ReportType
  if (!TYPES.has(reportType)) {
    return NextResponse.json({ error: 'invalid reportType' }, { status: 400 })
  }
  const report = await generateReport({
    reportType,
    walletAddress: body.walletAddress ?? null,
    userId: body.userId ?? null,
  })
  return NextResponse.json({ report })
}
