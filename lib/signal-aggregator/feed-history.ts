import 'server-only'

import type { SignalFeedFilter, SignalSubscriptionTier, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import {
  effectiveSignalFeedFilter,
  filterUnifiedSignals,
  parseSignalFeedFilterFromSearch,
  rowToUnifiedSignal,
} from '@/lib/signal-aggregator/feed-filters'

/** Vercel-native history — reads `signal_normalized` via Supabase (no Railway gateway). */
export async function fetchSignalHistory(params: {
  tier: SignalSubscriptionTier
  filter: SignalFeedFilter
  limit: number
}): Promise<UnifiedSignal[]> {
  const { tier, filter, limit } = params
  const effective = effectiveSignalFeedFilter(tier, filter)
  const cap = tier === 'premium' ? Math.min(limit, 200) : Math.min(limit, 25)
  const freeDelayMs = Number(process.env.SIGNAL_FREE_DELAY_MS ?? 90_000)

  let q = getSupabaseAdmin()
    .from('signal_normalized')
    .select('*')
    .eq('dropped', false)
    .eq('sample', false)
    .order('msg_timestamp', { ascending: false })
    .limit(cap * 3)

  if (effective.sourceTag && effective.sourceTag !== 'all') {
    q = q.eq('source_tag', effective.sourceTag)
  }
  if (effective.subjectType) q = q.eq('subject_type', effective.subjectType)
  if (effective.chain) q = q.eq('chain', effective.chain)

  if (tier === 'free') {
    const cutoff = new Date(Date.now() - freeDelayMs).toISOString()
    q = q.lte('msg_timestamp', cutoff)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((r) => rowToUnifiedSignal(r as Record<string, unknown>))
  return filterUnifiedSignals(rows, effective).slice(0, cap)
}

export async function fetchSignalHistoryForRequest(opts: {
  searchParams: URLSearchParams
  bearer?: string
  userId?: string
}): Promise<{ tier: SignalSubscriptionTier; signals: UnifiedSignal[] }> {
  const tier = await resolveSignalTier({
    bearerToken: opts.bearer,
    userId: opts.userId,
  })
  const filter = parseSignalFeedFilterFromSearch(opts.searchParams)
  const limit = Number(opts.searchParams.get('limit') ?? 50)
  const signals = await fetchSignalHistory({ tier, filter, limit })
  return { tier, signals }
}
