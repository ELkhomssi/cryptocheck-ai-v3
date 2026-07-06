import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFullAccessSnapshot } from '@/lib/billing/full-access'

export const dynamic = 'force-dynamic'

/** GET /api/billing/full-access — server-verified FULL_ACCESS for UI. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ fullAccess: false, authenticated: false })
  }

  const snap = await getFullAccessSnapshot(user.id)
  return NextResponse.json({
    authenticated: true,
    ...snap,
  })
}
