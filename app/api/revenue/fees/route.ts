import { NextRequest, NextResponse } from 'next/server'
import { assertDiagnosticsAdmin } from '@/lib/diagnostics/admin-auth'
import { buildRevenueMetrics } from '@/lib/revenue-dashboard/fee-analytics'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/revenue/fees — admin-only revenue aggregates + on-chain reconciliation. */
export async function GET(req: NextRequest) {
  const auth = await assertDiagnosticsAdmin(req.headers.get('authorization'))
  if (auth.ok === false) return auth.response

  try {
    const metrics = await buildRevenueMetrics()
    return NextResponse.json(metrics, { status: 200, headers: gatewayResponseHeaders() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Metrics failed'
    return NextResponse.json({ error: message }, { status: 500, headers: gatewayResponseHeaders() })
  }
}
