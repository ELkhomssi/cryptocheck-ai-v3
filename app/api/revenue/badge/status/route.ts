import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { getBadgeOrder, getBadgeByMint, badgeEmbedSnippet } from '@/lib/revenue-dashboard/verified-badge'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'

export const dynamic = 'force-dynamic'

/** GET /api/revenue/badge/status?orderId= | ?mint= */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')?.trim()
  const mint = req.nextUrl.searchParams.get('mint')?.trim()

  if (orderId) {
    const order = await getBadgeOrder(orderId)
    if (!order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: gatewayResponseHeaders() })
    }
    const badge = order.status === 'scanned' ? await getBadgeByMint(order.mint) : null
    const origin = req.nextUrl.origin
    return NextResponse.json(
      {
        order,
        badge,
        embedSnippet: badge ? badgeEmbedSnippet(order.mint, origin) : null,
      },
      { headers: gatewayResponseHeaders() },
    )
  }

  if (mint && isValidSolanaMint(mint)) {
    const badge = await getBadgeByMint(mint)
    const origin = req.nextUrl.origin
    return NextResponse.json(
      {
        badge,
        embedSnippet: badge ? badgeEmbedSnippet(mint, origin) : null,
      },
      { headers: gatewayResponseHeaders() },
    )
  }

  return NextResponse.json({ error: 'orderId or mint required' }, { status: 400, headers: gatewayResponseHeaders() })
}
