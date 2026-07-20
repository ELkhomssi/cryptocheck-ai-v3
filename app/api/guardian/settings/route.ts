import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import {
  getGuardianAutoExitConfig,
  isGuardianKillSwitchActive,
  listGuardianEventsForUser,
} from '@/lib/personal-watch/guardian-auto-exit'

export const dynamic = 'force-dynamic'

async function requirePremiumUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Auth required' }, { status: 401 }) }
  const tier = await resolveSignalTier({ userId: user.id })
  if (tier !== 'premium') {
    return { error: NextResponse.json({ error: 'Premium required', tier }, { status: 403 }) }
  }
  return { user }
}

/** GET /api/guardian/settings?mint= — config + kill-switch + recent events. */
export async function GET(req: NextRequest) {
  const gate = await requirePremiumUser()
  if ('error' in gate) return gate.error
  const { user } = gate

  const mint = req.nextUrl.searchParams.get('mint')?.trim() ?? ''
  const killSwitch = await isGuardianKillSwitchActive(user.id)
  const events = await listGuardianEventsForUser(user.id, 8)

  if (!mint) {
    const sb = getSupabaseAdmin()
    const { data: globalRow } = await sb
      .from('guardian_auto_exit_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    const { data: positions } = await sb
      .from('guardian_auto_exit_positions')
      .select('mint, enabled, max_slippage_bps, min_proceeds_ratio, authorized_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      killSwitch,
      global: globalRow ?? null,
      positions: positions ?? [],
      events,
    })
  }

  const config = await getGuardianAutoExitConfig(user.id, mint)
  return NextResponse.json({ killSwitch, mint, config, events })
}

/** PATCH /api/guardian/settings — toggle enabled (requires prior wallet authorization). */
export async function PATCH(req: NextRequest) {
  const gate = await requirePremiumUser()
  if ('error' in gate) return gate.error
  const { user } = gate

  const body = (await req.json().catch(() => ({}))) as {
    mint?: string
    enabled?: boolean
    maxSlippageBps?: number
    minProceedsRatio?: number
    global?: boolean
  }

  const sb = getSupabaseAdmin()
  const enabled = body.enabled === true
  const maxSlippageBps = Number.isFinite(Number(body.maxSlippageBps))
    ? Math.min(2000, Math.max(10, Number(body.maxSlippageBps)))
    : undefined
  const minProceedsRatio = Number.isFinite(Number(body.minProceedsRatio))
    ? Math.min(1, Math.max(0.01, Number(body.minProceedsRatio)))
    : undefined

  if (body.global || !body.mint?.trim()) {
    const { data: existing } = await sb
      .from('guardian_auto_exit_settings')
      .select('authorized_wallet, authorized_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (enabled && (!existing?.authorized_wallet || !existing?.authorized_at)) {
      return NextResponse.json(
        { error: 'Wallet authorization required before arming global auto-exit' },
        { status: 422 },
      )
    }

    await sb.from('guardian_auto_exit_settings').upsert(
      {
        user_id: user.id,
        enabled,
        ...(maxSlippageBps != null ? { max_slippage_bps: maxSlippageBps } : {}),
        ...(minProceedsRatio != null ? { min_proceeds_ratio: minProceedsRatio } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return NextResponse.json({ ok: true, scope: 'global', enabled })
  }

  const mint = body.mint.trim()
  const { data: existing } = await sb
    .from('guardian_auto_exit_positions')
    .select('authorized_wallet, authorized_at')
    .eq('user_id', user.id)
    .eq('mint', mint)
    .maybeSingle()

  if (enabled && (!existing?.authorized_wallet || !existing?.authorized_at)) {
    return NextResponse.json(
      { error: 'Wallet authorization required before arming auto-exit on this position' },
      { status: 422 },
    )
  }

  await sb.from('guardian_auto_exit_positions').upsert(
    {
      user_id: user.id,
      mint,
      enabled,
      ...(maxSlippageBps != null ? { max_slippage_bps: maxSlippageBps } : {}),
      ...(minProceedsRatio != null ? { min_proceeds_ratio: minProceedsRatio } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,mint' },
  )

  return NextResponse.json({ ok: true, scope: 'position', mint, enabled })
}
