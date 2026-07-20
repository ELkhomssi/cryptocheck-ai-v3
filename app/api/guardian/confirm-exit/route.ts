import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import { confirmGuardianAutoExit } from '@/lib/personal-watch/guardian-auto-exit'

export const dynamic = 'force-dynamic'

/** POST /api/guardian/confirm-exit — record tx signature after wallet signs (non-custodial). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const tier = await resolveSignalTier({ userId: user.id })
  if (tier !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    pendingId?: string
    txSignature?: string
  }
  const pendingId = body.pendingId?.trim() ?? ''
  const txSignature = body.txSignature?.trim() ?? ''

  if (!pendingId || txSignature.length < 32) {
    return NextResponse.json({ error: 'pendingId and txSignature required' }, { status: 400 })
  }

  const result = await confirmGuardianAutoExit({
    userId: user.id,
    pendingId,
    txSignature,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Confirm failed' }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    txSignature,
    explorerUrl: `https://solscan.io/tx/${txSignature}`,
    savedYouNote: 'Auto-exit logged for Saved-You grading when rug evidence confirms.',
  })
}
