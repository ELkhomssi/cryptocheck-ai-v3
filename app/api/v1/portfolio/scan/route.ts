import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { mapWithConcurrency } from '@/lib/concurrency/pool'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveConsumerTier, type ConsumerTier } from '@/lib/billing/consumer-tier'
import { fetchWalletHoldings } from '@/lib/helius/fetch-wallet-holdings'
import { scanTokenIntelligence } from '@/lib/services/scanner/execute-scan'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIER_LIMITS: Record<ConsumerTier, { maxTokens: number; scansPerDay: number }> = {
  free: { maxTokens: 10, scansPerDay: 1 },
  micropack: { maxTokens: 25, scansPerDay: 3 },
  pro: { maxTokens: 50, scansPerDay: 20 },
  elite: { maxTokens: 100, scansPerDay: 100 },
}

const SCAN_CONCURRENCY = 6
const BASELINE_SCAN_COOLDOWN_MS = 60_000

function isValidSolanaAddress(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  try {
    const pk = new PublicKey(t)
    return PublicKey.isOnCurve(pk.toBytes())
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { walletAddress?: unknown }
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    const sb = getSupabaseAdmin()
    const tier = await resolveConsumerTier(user.id)
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free

    const minuteAgoIso = new Date(Date.now() - BASELINE_SCAN_COOLDOWN_MS).toISOString()
    const { count: lastMinuteCount } = await sb
      .from('portfolio_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('scanned_at', minuteAgoIso)

    if ((lastMinuteCount ?? 0) >= 1) {
      return NextResponse.json(
        {
          error: 'Too many scans. Please wait 1 minute before scanning again.',
          retryAfterSeconds: 60,
        },
        { status: 429 }
      )
    }

    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)

    const { count: scansToday } = await sb
      .from('portfolio_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('scanned_at', dayStart.toISOString())

    if ((scansToday ?? 0) >= limits.scansPerDay) {
      return NextResponse.json(
        {
          error: 'Daily scan limit reached',
          limit: limits.scansPerDay,
          scansUsedToday: scansToday ?? 0,
          tier,
          upgradeUrl: '/app',
        },
        { status: 429 }
      )
    }

    const holdings = await fetchWalletHoldings(walletAddress, {
      maxTokens: limits.maxTokens,
    })

    if (!holdings.length) {
      return NextResponse.json({
        holdings: [],
        summary: { totalTokens: 0, totalValueUsd: 0, riskyTokensCount: 0, avgRiskScore: 0 },
        tier,
        limits,
      })
    }

    const scanResults = await mapWithConcurrency(holdings, SCAN_CONCURRENCY, async (holding) => {
      const scan = await scanTokenIntelligence({ mint: holding.mint, mode: 'full' })
      return {
        ...holding,
        riskScore: scan.riskScore,
        verdict: scan.verdict,
        signals: scan.topSignals,
      }
    })

    const riskyTokens = scanResults.filter((s) => s.riskScore >= 70)
    const totalValue = scanResults.reduce((sum, s) => sum + (s.valueUsd ?? 0), 0)
    const avgRisk =
      scanResults.length > 0
        ? scanResults.reduce((sum, row) => sum + row.riskScore, 0) / scanResults.length
        : 0

    const { data: snapshot } = await sb
      .from('portfolio_snapshots')
      .insert({
        user_id: user.id,
        wallet_address: walletAddress,
        total_tokens: scanResults.length,
        total_value_usd: totalValue,
        risky_tokens_count: riskyTokens.length,
        snapshot_data: scanResults,
      })
      .select('id')
      .single()

    return NextResponse.json({
      snapshotId: snapshot?.id ?? null,
      holdings: scanResults,
      summary: {
        totalTokens: scanResults.length,
        totalValueUsd: totalValue,
        riskyTokensCount: riskyTokens.length,
        avgRiskScore: avgRisk,
      },
      tier,
      limits,
      scansUsedToday: (scansToday ?? 0) + 1,
    })
  } catch (err) {
    console.error('[portfolio-scan] Error:', err)
    return NextResponse.json({ error: 'Portfolio scan failed. Please try again.' }, { status: 500 })
  }
}
