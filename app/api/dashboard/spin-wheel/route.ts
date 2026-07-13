import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  canSpinAgain,
  msUntilNextSpin,
  nextSpinAt,
  pickSpinPrize,
  type SpinPrize,
} from '@/lib/dashboard/spin-wheel'

export const dynamic = 'force-dynamic'

type SpinStatus = {
  authenticated: boolean
  canSpin: boolean
  lastSpinDate: string | null
  nextSpinAt: string | null
  msUntilNext: number
  credits: number | null
}

function sessionClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    },
  )
}

async function readStatus(userId: string | null): Promise<SpinStatus> {
  if (!userId) {
    return {
      authenticated: false,
      canSpin: false,
      lastSpinDate: null,
      nextSpinAt: null,
      msUntilNext: 0,
      credits: null,
    }
  }

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('last_spin_date, credits')
    .eq('id', userId)
    .maybeSingle()

  const last = (profile?.last_spin_date as string | null) ?? null
  const can = canSpinAgain(last)

  return {
    authenticated: true,
    canSpin: can,
    lastSpinDate: last,
    nextSpinAt: can ? null : nextSpinAt(last),
    msUntilNext: msUntilNextSpin(last),
    credits: typeof profile?.credits === 'number' ? profile.credits : null,
  }
}

/** GET — auth + cooldown status (no spin). */
export async function GET(req: NextRequest) {
  try {
    const supabase = sessionClient(req)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const status = await readStatus(user?.id ?? null)
    return NextResponse.json(status, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'spin status failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST — claim one spin (24h gate). Awards scan credits when prize.credits > 0.
 * Atomic: only updates when last_spin_date is null or older than 24h.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = sessionClient(req)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign in to spin', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: profile, error: fetchErr } = await admin
      .from('profiles')
      .select('last_spin_date, credits')
      .eq('id', user.id)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found — complete sign-in first', code: 'NO_PROFILE' },
        { status: 404 },
      )
    }

    const last = (profile?.last_spin_date as string | null) ?? null
    if (!canSpinAgain(last)) {
      return NextResponse.json(
        {
          error: 'Already spun in the last 24 hours',
          code: 'COOLDOWN',
          ...(await readStatus(user.id)),
        },
        { status: 429 },
      )
    }

    const prize: SpinPrize = pickSpinPrize()
    const nowIso = new Date().toISOString()
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const currentCredits = typeof profile.credits === 'number' ? profile.credits : 0
    const nextCredits = currentCredits + prize.credits

    // Atomic claim: only succeed if still outside the 24h window.
    const { data: updated, error: upErr } = await admin
      .from('profiles')
      .update({ last_spin_date: nowIso, credits: nextCredits })
      .eq('id', user.id)
      .or(`last_spin_date.is.null,last_spin_date.lt.${cutoffIso}`)
      .select('last_spin_date, credits')
      .maybeSingle()

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json(
        {
          error: 'Already spun in the last 24 hours',
          code: 'COOLDOWN',
          ...(await readStatus(user.id)),
        },
        { status: 429 },
      )
    }

    return NextResponse.json({
      ok: true,
      prize,
      lastSpinDate: updated.last_spin_date,
      nextSpinAt: nextSpinAt(updated.last_spin_date as string),
      canSpin: false,
      credits: updated.credits,
      authenticated: true,
      msUntilNext: msUntilNextSpin(updated.last_spin_date as string),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'spin failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
