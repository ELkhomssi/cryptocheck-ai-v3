import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { getLiveBadgePayload } from '@/lib/revenue-dashboard/verified-badge'

export const dynamic = 'force-dynamic'

const CORS = gatewayResponseHeaders({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
})

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** GET /api/revenue/badge/live?mint= — embeddable live verdict (paid badges only). */
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint')?.trim() ?? ''
  if (!isValidSolanaMint(mint)) {
    return NextResponse.json({ error: 'Invalid mint' }, { status: 400, headers: CORS })
  }

  const payload = await getLiveBadgePayload(mint)
  if (!payload) {
    return NextResponse.json(
      { paid: false, mint, error: 'No verified badge for this mint' },
      { status: 404, headers: CORS },
    )
  }

  return NextResponse.json(payload, { status: 200, headers: CORS })
}
