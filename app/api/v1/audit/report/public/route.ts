import { NextRequest, NextResponse } from 'next/server'
import { scanClientIp } from '@/lib/auth/scan-access'
import { enforcePublicProAuditLimit } from '@/lib/rate-limit/public-pro-portal'
import { buildAuditReportJson, buildAuditReportPdfBuffer } from '@/lib/services/audit-report.service'
import type { ScanV1ApiResponse } from '@/lib/types/institutional-scan-api'

type ReasoningObject = ScanV1ApiResponse['reasoning']
import { mergeWithRateLimitHeaders } from '@/lib/api/scan-api-errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Unauthenticated PDF/JSON audit export for `/pro/dashboard` (rate limited by IP).
 */
export async function POST(req: NextRequest) {
  const ip = scanClientIp(req) || 'unknown'
  const limit = await enforcePublicProAuditLimit(ip)
  if (!limit.ok) {
    const retrySec = Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Too many export requests. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retrySec),
          ...mergeWithRateLimitHeaders({ limit: limit.limit, remaining: limit.remaining, reset: limit.reset }),
        },
      }
    )
  }

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
          ...mergeWithRateLimitHeaders({ limit: limit.limit, remaining: limit.remaining, reset: limit.reset }),
        },
      })
    }

    const json = buildAuditReportJson({ mint, tokenName, reasoning, generatedAt })
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...mergeWithRateLimitHeaders({ limit: limit.limit, remaining: limit.remaining, reset: limit.reset }),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Report failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
