import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { isValidSolanaMint } from '@/lib/validation/mint'
import {
  getAlertOptIn,
  listAlerts,
  markAlertRead,
  refreshAlertsForWallet,
  setAlertOptIn,
} from '@/lib/revenue-dashboard/alert-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/revenue/alerts?wallet= — list alerts; refreshes when opt-in enabled. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json(
      { error: 'Valid wallet required', code: 'INVALID_WALLET' },
      { status: 400, headers: gatewayResponseHeaders() },
    )
  }

  const optIn = await getAlertOptIn(wallet)
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  const alerts = optIn && refresh ? await refreshAlertsForWallet(wallet) : await listAlerts(wallet)

  return NextResponse.json({ wallet, optIn, alerts }, { status: 200, headers: gatewayResponseHeaders() })
}

/** POST /api/revenue/alerts — opt-in toggle or mark read. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string
    optIn?: boolean
    markReadId?: string
  }
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400, headers: gatewayResponseHeaders() })
  }

  if (typeof body.optIn === 'boolean') {
    await setAlertOptIn(wallet, body.optIn)
    const alerts = body.optIn ? await refreshAlertsForWallet(wallet) : await listAlerts(wallet)
    return NextResponse.json({ ok: true, optIn: body.optIn, alerts }, { headers: gatewayResponseHeaders() })
  }

  if (typeof body.markReadId === 'string') {
    await markAlertRead(wallet, body.markReadId)
    return NextResponse.json({ ok: true }, { headers: gatewayResponseHeaders() })
  }

  return NextResponse.json({ error: 'optIn or markReadId required' }, { status: 400, headers: gatewayResponseHeaders() })
}
