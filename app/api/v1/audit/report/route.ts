import { NextRequest, NextResponse } from 'next/server'
import { withProFeature } from '@/lib/auth/pro-feature-access'
import { buildAuditReportJson, buildAuditReportPdfBuffer } from '@/lib/services/audit-report.service'
import type { ReasoningObject } from '@/lib/services/scanner-engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = withProFeature(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const format = body.format === 'pdf' ? 'pdf' : 'json'
    const mint = typeof body.mint === 'string' ? body.mint.trim() : ''
    const reasoning = body.reasoning as ReasoningObject | undefined
    if (!mint || mint.length < 32 || !reasoning?.evidence) {
      return NextResponse.json({ error: 'Invalid mint or reasoning payload' }, { status: 400 })
    }
    const tokenName = typeof body.tokenName === 'string' ? body.tokenName : undefined
    const generatedAt = new Date().toISOString()

    if (format === 'pdf') {
      const buf = await buildAuditReportPdfBuffer({ mint, tokenName, reasoning, generatedAt })
      const filename = `cryptocheck-audit-${mint.slice(0, 8)}.pdf`
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    const json = buildAuditReportJson({ mint, tokenName, reasoning, generatedAt })
    return new NextResponse(json, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Report failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})
