/**
 * GET /api/auth/siws/me — current SIWS session + wallets + entitlement
 */

import { NextRequest, NextResponse } from 'next/server'
import { readSiwsSessionFromRequest } from '@/lib/identity/session'
import { listWalletsForUser } from '@/lib/identity/siws'
import { getEntitlement } from '@/lib/identity/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = readSiwsSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ authenticated: false })
  }
  const wallets = await listWalletsForUser(session.userId)
  const entitlement = await getEntitlement(session.userId)
  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    wallet: session.wallet,
    wallets,
    entitlement,
  })
}
