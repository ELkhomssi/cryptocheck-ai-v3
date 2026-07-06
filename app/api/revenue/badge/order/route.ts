import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { createBadgeOrder } from '@/lib/revenue-dashboard/verified-badge'

export const dynamic = 'force-dynamic'

const CORS = gatewayResponseHeaders({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
})

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** POST /api/revenue/badge/order — create pay-to-be-scanned badge order. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { mint?: string }
  const mint = typeof body.mint === 'string' ? body.mint.trim() : ''
  if (!isValidSolanaMint(mint)) {
    return NextResponse.json({ error: 'Valid mint required' }, { status: 400, headers: CORS })
  }

  const order = await createBadgeOrder(mint)
  return NextResponse.json(
    {
      order,
      paymentMemo: `badge:${order.id}`,
    },
    { status: 201, headers: CORS },
  )
}
