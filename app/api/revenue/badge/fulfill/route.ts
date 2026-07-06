import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { fulfillBadgeOrder } from '@/lib/revenue-dashboard/verified-badge'

export const dynamic = 'force-dynamic'

const CORS = gatewayResponseHeaders({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
})

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** POST /api/revenue/badge/fulfill — payment confirmed → independent gateway scan → badge. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { orderId?: string; intentId?: string }
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : ''
  if (!orderId.startsWith('badge_') || !intentId.startsWith('pi_')) {
    return NextResponse.json({ error: 'orderId and intentId required' }, { status: 400, headers: CORS })
  }

  try {
    const snapshot = await fulfillBadgeOrder(orderId, intentId)
    return NextResponse.json({ ok: true, badge: snapshot }, { status: 200, headers: CORS })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Fulfillment failed'
    return NextResponse.json({ error: message }, { status: 400, headers: CORS })
  }
}
