import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveConsumerTier, type ConsumerTier } from '@/lib/billing/consumer-tier'
import { scanTokenIntelligenceViaGateway } from '@/lib/connect/scan-gateway'
import { isValidSolanaAddress } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WATCHLIST_LIMITS: Record<ConsumerTier, number> = {
  free: 3,
  micropack: 10,
  pro: 25,
  elite: Number.MAX_SAFE_INTEGER,
  enterprise: Number.MAX_SAFE_INTEGER,
}

async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  try {
    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const sb = getSupabaseAdmin()
    const tier = await resolveConsumerTier(userId)
    const limit = WATCHLIST_LIMITS[tier] ?? WATCHLIST_LIMITS.free

    const [{ data: rows, error }, { count }] = await Promise.all([
      sb
        .from('watchlist')
        .select(
          'id, mint, symbol, name, last_risk_score, last_verdict, last_scanned_at, created_at, is_favorite, sort_order',
        )
        .eq('user_id', userId)
        .order('is_favorite', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
      sb.from('watchlist').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ])

    if (error) throw error

    return NextResponse.json({
      items: rows ?? [],
      tier,
      usage: {
        used: count ?? 0,
        limit: Number.isFinite(limit) ? limit : null,
      },
    })
  } catch (err) {
    console.error('[watchlist:get] Error:', err)
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as {
      mint?: unknown
      symbol?: unknown
      name?: unknown
    }
    const mint = typeof body.mint === 'string' ? body.mint.trim() : ''
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim().slice(0, 32) : null
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null

    if (!mint || !isValidSolanaAddress(mint)) {
      return NextResponse.json({ error: 'Invalid mint address' }, { status: 400 })
    }

    const sb = getSupabaseAdmin()
    const tier = await resolveConsumerTier(userId)
    const limit = WATCHLIST_LIMITS[tier] ?? WATCHLIST_LIMITS.free

    const { count } = await sb.from('watchlist').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        {
          error: 'Watchlist limit reached',
          tier,
          limit,
          used: count ?? 0,
          upgradeUrl: '/app',
        },
        { status: 429 }
      )
    }

    let lastRiskScore: number | null = null
    let lastVerdict: string | null = null
    try {
      const scan = await scanTokenIntelligenceViaGateway({ mint, mode: 'full' })
      lastRiskScore = scan.riskScore
      lastVerdict = scan.verdict
    } catch {
      // token can still be added if scan is temporarily unavailable
    }

    const { data, error } = await sb
      .from('watchlist')
      .upsert(
        {
          user_id: userId,
          mint,
          symbol,
          name,
          last_risk_score: lastRiskScore,
          last_verdict: lastVerdict,
          last_scanned_at: lastRiskScore == null ? null : new Date().toISOString(),
          is_favorite: false,
          sort_order: 0,
        },
        { onConflict: 'user_id,mint' }
      )
      .select(
        'id, mint, symbol, name, last_risk_score, last_verdict, last_scanned_at, created_at, is_favorite, sort_order',
      )
      .single()

    if (error) throw error

    const used = Math.min((count ?? 0) + 1, limit)
    return NextResponse.json(
      {
        item: data,
        tier,
        usage: {
          used,
          limit: Number.isFinite(limit) ? limit : null,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[watchlist:add] Error:', err)
    return NextResponse.json({ error: 'Failed to add token to watchlist' }, { status: 500 })
  }
}
