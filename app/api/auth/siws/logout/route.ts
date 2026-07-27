/**
 * POST /api/auth/siws/logout — clear SIWS session cookie
 */

import { NextResponse } from 'next/server'
import { clearSiwsCookie } from '@/lib/identity/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearSiwsCookie(res)
  return res
}
