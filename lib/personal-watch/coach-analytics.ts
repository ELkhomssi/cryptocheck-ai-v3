import 'server-only'

import { listFeeRecords } from '@/lib/revenue-dashboard/fee-store'
import type { FeeRecord } from '@/lib/revenue-dashboard/types'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  COACH_MIN_TRADES_FOR_INSIGHT,
  type CitedTrade,
  type CoachInsight,
  type CoachVerdict,
  type CoachWeeklySummary,
} from './constants'
import { countWatchDegradesSince, listWatchDegradeEventsForUser } from './events'
import { applyFreeTierWatchDelay } from './coach-delay'
import { listGuardianEventsForUser } from './guardian-auto-exit'
import { nearestSnapshotBefore } from './snapshot-store'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

/** Output mint for buys (SOL → token); input mint for sells (token → SOL). */
function tradeTokenMint(fee: FeeRecord): string {
  if (fee.outputMint !== SOL_MINT && fee.outputMint.length >= 32) return fee.outputMint
  if (fee.inputMint !== SOL_MINT && fee.inputMint.length >= 32) return fee.inputMint
  return fee.outputMint
}

function isBuy(fee: FeeRecord): boolean {
  return fee.inputMint === SOL_MINT || fee.inputMint.endsWith('11111111111111111111111111111111')
}

export async function resolveUserWallet(userId: string): Promise<string | null> {
  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb.from('profiles').select('wallet_address').eq('id', userId).maybeSingle()
    const w = data && typeof (data as { wallet_address?: string }).wallet_address === 'string'
      ? String((data as { wallet_address: string }).wallet_address).trim()
      : ''
    return w.length >= 32 ? w : null
  } catch {
    return null
  }
}

export async function listFeeRecordsForWallet(wallet: string, limit = 200): Promise<FeeRecord[]> {
  const all = await listFeeRecords(Math.min(limit * 4, 2000))
  return all.filter((r) => r.walletAddress === wallet).slice(0, limit)
}

async function enrichWithEntryVerdict(fees: FeeRecord[]): Promise<CitedTrade[]> {
  const out: CitedTrade[] = []
  for (const fee of fees) {
    const mint = tradeTokenMint(fee)
    const snap = await nearestSnapshotBefore(mint, fee.executedAt)
    out.push({
      feeRecordId: fee.id,
      signature: fee.signature,
      mint,
      executedAt: fee.executedAt,
      volumeUsd: fee.volumeUsd,
      entryVerdict: (snap?.verdict as CoachVerdict | undefined) ?? 'unknown',
      entrySafetyScore: snap?.safetyScore ?? null,
    })
  }
  return out
}

/**
 * Read-only behavioral insights from real FeeRecords only.
 * Every insight cites specific trades. Empty if sample too small.
 */
export async function buildCoachInsights(userId: string): Promise<{
  insights: CoachInsight[]
  tradeCount: number
  emptyReason: string | null
}> {
  const wallet = await resolveUserWallet(userId)
  if (!wallet) {
    return {
      insights: [],
      tradeCount: 0,
      emptyReason: 'Link a wallet on your profile to analyze your own platform trades.',
    }
  }

  const fees = await listFeeRecordsForWallet(wallet, 100)
  const buys = fees.filter(isBuy)
  const tradeCount = fees.length

  if (buys.length < COACH_MIN_TRADES_FOR_INSIGHT) {
    return {
      insights: [],
      tradeCount,
      emptyReason: `Need at least ${COACH_MIN_TRADES_FOR_INSIGHT} platform entries for a meaningful pattern (you have ${buys.length}).`,
    }
  }

  const cited = await enrichWithEntryVerdict(buys)
  const withVerdict = cited.filter((c) => c.entryVerdict !== 'unknown')
  if (withVerdict.length < COACH_MIN_TRADES_FOR_INSIGHT) {
    return {
      insights: [],
      tradeCount,
      emptyReason:
        'Not enough trades with a known scan verdict at entry yet. Keep trading through CryptoCheck so entry scans can be joined.',
    }
  }

  const insights: CoachInsight[] = []

  const cautionOrWorse = withVerdict.filter(
    (c) => c.entryVerdict === 'CAUTION' || c.entryVerdict === 'DANGER',
  )
  if (cautionOrWorse.length >= 3) {
    insights.push({
      id: 'entry_timing_caution',
      kind: 'entry_timing',
      summary: `${cautionOrWorse.length} of your last ${withVerdict.length} entries were placed while the token was already CAUTION or DANGER.`,
      citedTrades: cautionOrWorse,
      sampleSize: withVerdict.length,
    })
  }

  const byVerdict: Record<string, CitedTrade[]> = { SAFE: [], CAUTION: [], DANGER: [] }
  for (const c of withVerdict) {
    if (c.entryVerdict === 'SAFE' || c.entryVerdict === 'CAUTION' || c.entryVerdict === 'DANGER') {
      byVerdict[c.entryVerdict].push(c)
    }
  }
  const parts: string[] = []
  for (const v of ['SAFE', 'CAUTION', 'DANGER'] as const) {
    const rows = byVerdict[v]
    if (rows.length === 0) continue
    const vol = rows.reduce((s, r) => s + (r.volumeUsd || 0), 0)
    parts.push(`${v}: ${rows.length} entries · ~$${vol.toFixed(0)} notional`)
  }
  if (parts.length >= 2) {
    insights.push({
      id: 'verdict_volume_mix',
      kind: 'verdict_pnl',
      summary: `Entry mix by scan verdict at time of trade — ${parts.join('; ')}. (P&L requires round-trips; volume shown is executed notional.)`,
      citedTrades: withVerdict,
      sampleSize: withVerdict.length,
    })
  }

  // Holding-period proxy: time gaps between consecutive buys of same mint (observable clustering).
  const byMint = new Map<string, CitedTrade[]>()
  for (const c of withVerdict) {
    const arr = byMint.get(c.mint) ?? []
    arr.push(c)
    byMint.set(c.mint, arr)
  }
  const clustered: CitedTrade[] = []
  for (const rows of byMint.values()) {
    const sorted = [...rows].sort((a, b) => Date.parse(a.executedAt) - Date.parse(b.executedAt))
    for (let i = 1; i < sorted.length; i++) {
      const gap = Date.parse(sorted[i]!.executedAt) - Date.parse(sorted[i - 1]!.executedAt)
      if (gap > 0 && gap <= 5 * 60_000) {
        clustered.push(sorted[i]!, sorted[i - 1]!)
      }
    }
  }
  const uniqCluster = Array.from(new Map(clustered.map((c) => [c.feeRecordId, c])).values())
  if (uniqCluster.length >= 4) {
    insights.push({
      id: 'holding_cluster_5m',
      kind: 'holding_period',
      summary: `${uniqCluster.length} entries cluster within 5 minutes of another entry on the same mint (observable timing pattern from your FeeRecords).`,
      citedTrades: uniqCluster,
      sampleSize: withVerdict.length,
    })
  }

  if (insights.length === 0) {
    return {
      insights: [],
      tradeCount,
      emptyReason:
        'No strong pattern met the citation threshold yet. Insights appear only when enough real trades share an observable trait.',
    }
  }

  return { insights, tradeCount, emptyReason: null }
}

export async function buildCoachWeeklySummary(userId: string): Promise<CoachWeeklySummary> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const sb = getSupabaseAdmin()
  let savesThisWeek = 0
  try {
    const { count } = await sb
      .from('saved_you')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('graded_at', weekAgo)
    savesThisWeek = count ?? 0
  } catch {
    savesThisWeek = 0
  }

  const degradeAlertsThisWeek = await countWatchDegradesSince(userId, weekAgo)
  const { insights } = await buildCoachInsights(userId)
  const patternsFlagged = insights.length

  const line = `This week: ${savesThisWeek} save${savesThisWeek === 1 ? '' : 's'}, ${patternsFlagged} pattern${patternsFlagged === 1 ? '' : 's'} flagged, ${degradeAlertsThisWeek} watch alert${degradeAlertsThisWeek === 1 ? '' : 's'}`

  return { savesThisWeek, patternsFlagged, degradeAlertsThisWeek, line }
}

export async function buildCoachDashboard(userId: string, tier: 'free' | 'premium' = 'premium') {
  const [rawAlerts, insightPack, weekly, saves, guardianEvents] = await Promise.all([
    listWatchDegradeEventsForUser(userId, 15),
    buildCoachInsights(userId),
    buildCoachWeeklySummary(userId),
    (async () => {
      try {
        const sb = getSupabaseAdmin()
        const { data } = await sb
          .from('saved_you')
          .select('id, mint, symbol, graded_at, outcome_evidence, loss_avoided_estimate, explorer_url')
          .eq('user_id', userId)
          .order('graded_at', { ascending: false })
          .limit(5)
        return data ?? []
      } catch {
        return []
      }
    })(),
    listGuardianEventsForUser(userId, 5),
  ])

  const { alerts, delayedTeaser, upgradeHint } = applyFreeTierWatchDelay(rawAlerts, tier)

  return {
    weekly,
    alerts,
    delayedTeaser,
    upgradeHint,
    insights: insightPack.insights,
    insightEmptyReason: insightPack.emptyReason,
    tradeCount: insightPack.tradeCount,
    saves,
    guardianEvents,
  }
}
