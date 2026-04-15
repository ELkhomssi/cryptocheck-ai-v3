import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardUsageBundle } from '@/lib/services/usage-analytics.service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30', 10) || 30))
  const bundle = await getDashboardUsageBundle(user.id, days)
  return NextResponse.json(bundle)
}
