import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { createClient } from '@/lib/supabase/server'
import { userHasFullPlatformAccess } from '@/lib/billing/full-access'
import { requireSessionFullAccess } from '@/lib/middleware/require-full-access'
import { getArmState, setArmState, MAX_AMOUNT_USD } from '@/lib/signal-aggregator/snipe-execution'

export const dynamic = 'force-dynamic'

/** GET — current arming state for the signed-in user. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ authenticated: false, fullAccess: false }, { status: 200 })
  }

  const [fullAccess, arm] = await Promise.all([
    userHasFullPlatformAccess(user.id),
    getArmState(user.id),
  ])

  return NextResponse.json(
    {
      authenticated: true,
      fullAccess,
      arm: { ...arm, armed: arm.armed && fullAccess },
      maxAmountCeilingUsd: MAX_AMOUNT_USD,
      compliance: SIGNAL_COMPLIANCE,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}

/**
 * POST — arm / disarm Full Auto (Pro $10/mo only).
 * Body: { armed: boolean, maxAmountUsd?, slippageBps?, minScore? }
 * Arming auto-expires (TTL) so it never runs unattended indefinitely.
 */
export async function POST(req: Request) {
  const gate = await requireSessionFullAccess()
  if (!gate.ok) return (gate as { response: NextResponse }).response

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const arm = await setArmState(gate.userId, {
    armed: body.armed === true,
    maxAmountUsd: numOrUndef(body.maxAmountUsd),
    slippageBps: numOrUndef(body.slippageBps),
    minScore: numOrUndef(body.minScore),
  })

  return NextResponse.json(
    { ok: true, arm, maxAmountCeilingUsd: MAX_AMOUNT_USD, compliance: SIGNAL_COMPLIANCE },
    { headers: { 'cache-control': 'no-store' } },
  )
}

function numOrUndef(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
