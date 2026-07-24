import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserIdAndTier } from '@/lib/auth/pro-feature-access'
import {
  enabledTypeSet,
  getAlertPreferences,
  preferenceUserId,
} from '@/lib/portfolio-desk/alert-preferences'
import { alertsForSymbols, listAlerts } from '@/lib/portfolio-desk/alerts-store'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/alerts?wallet=…
 * Latest alerts for tokens the wallet holds (from Helius webhook store).
 * When preferences exist for the wallet/session, disabled types are filtered out.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  try {
    let alerts =
      wallet.length >= 32
        ? await (async () => {
            const holdings = await buildHoldingsResponse(wallet)
            const symbols = new Set(holdings.holdings.map((h) => h.symbol.toUpperCase()))
            return alertsForSymbols(symbols, 40)
          })()
        : await listAlerts(40)

    const sess = await getSessionUserIdAndTier(req).catch(() => null)
    const userId = preferenceUserId({
      sessionUserId: sess?.userId,
      wallet: wallet || null,
    })
    if (userId) {
      const prefs = await getAlertPreferences(userId)
      const enabled = enabledTypeSet(prefs)
      alerts = alerts.filter((a) => enabled.has(a.type))
    }

    return NextResponse.json({
      alerts: alerts.slice(0, 20),
      fetchedAt: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ alerts: await listAlerts(20) })
  }
}
