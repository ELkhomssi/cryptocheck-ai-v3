import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserIdAndTier } from '@/lib/auth/pro-feature-access'
import { ALL_ALERT_TYPES } from '@/lib/portfolio-desk/alert-classify'
import {
  getAlertPreferences,
  preferenceUserId,
  setAlertPreferences,
} from '@/lib/portfolio-desk/alert-preferences'
import type { AlertPreference, PortfolioAlertType } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/alerts/preferences?wallet=…
 * Returns enable/disable flags for every PortfolioAlertType.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  const sess = await getSessionUserIdAndTier(req).catch(() => null)
  const userId = preferenceUserId({
    sessionUserId: sess?.userId,
    wallet: wallet || null,
  })
  if (!userId) {
    return NextResponse.json(
      { error: 'wallet or authenticated session required' },
      { status: 400 },
    )
  }
  const preferences = await getAlertPreferences(userId)
  return NextResponse.json({
    preferences,
    types: ALL_ALERT_TYPES,
    userId,
    wallet: wallet || null,
  })
}

/**
 * PUT /api/portfolio/alerts/preferences
 * Body: { wallet?: string, preferences: { alertType, enabled }[] }
 */
export async function PUT(req: NextRequest) {
  let body: {
    wallet?: string
    preferences?: { alertType?: string; enabled?: boolean }[]
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  const sess = await getSessionUserIdAndTier(req).catch(() => null)
  const userId = preferenceUserId({
    sessionUserId: sess?.userId,
    wallet: wallet || null,
  })
  if (!userId) {
    return NextResponse.json(
      { error: 'wallet or authenticated session required' },
      { status: 400 },
    )
  }

  const raw = Array.isArray(body.preferences) ? body.preferences : []
  const preferences: AlertPreference[] = []
  for (const p of raw) {
    const alertType = typeof p.alertType === 'string' ? p.alertType : ''
    if (!ALL_ALERT_TYPES.includes(alertType as PortfolioAlertType)) continue
    preferences.push({
      alertType: alertType as PortfolioAlertType,
      enabled: Boolean(p.enabled),
    })
  }
  if (!preferences.length) {
    return NextResponse.json({ error: 'preferences required' }, { status: 400 })
  }

  const next = await setAlertPreferences({ userId, wallet, preferences })
  return NextResponse.json({ preferences: next, userId, wallet: wallet || null })
}
