import { NextRequest, NextResponse } from 'next/server'
import { getBotIntelligenceSnapshot } from '@/lib/bot-protection/intelligence'
import { isOperatorUser } from '@/lib/operator/require-operator'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Operator-only bot intelligence feed.
 */
export async function GET(req: NextRequest) {
  const cron = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const cronOk =
    Boolean(process.env.CRON_SECRET?.trim()) && cron === process.env.CRON_SECRET?.trim()

  if (!cronOk) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isOperatorUser(user.id, user.email))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const snapshot = await getBotIntelligenceSnapshot()
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
