import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** GET /api/signals/vapid-public-key — browser push subscription. */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!key) {
    return NextResponse.json({ configured: false })
  }
  return NextResponse.json({ configured: true, publicKey: key })
}
