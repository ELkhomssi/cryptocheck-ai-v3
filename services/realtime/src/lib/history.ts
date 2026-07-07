import { createClient } from '@supabase/supabase-js'
import type { SignalFeedFilter, SignalSubscriptionTier, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { effectiveFilter, rowToUnifiedSignal } from './filters.js'
import { resolveTierRemote } from './tier-remote.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function resolveTier(opts: {
  bearer?: string
  userId?: string
}): Promise<SignalSubscriptionTier> {
  return resolveTierRemote({ bearerToken: opts.bearer, userId: opts.userId })
}

export async function fetchHistory(
  tier: SignalSubscriptionTier,
  filter: SignalFeedFilter,
  limit: number,
): Promise<UnifiedSignal[]> {
  const sb = getSupabase()
  const effective = effectiveFilter(tier, filter)
  const cap = tier === 'premium' ? Math.min(limit, 200) : Math.min(limit, 25)
  const freeDelayMs = Number(process.env.SIGNAL_FREE_DELAY_MS ?? 90_000)

  let q = sb
    .from('signal_normalized')
    .select('*')
    .eq('dropped', false)
    .eq('sample', false)
    .order('msg_timestamp', { ascending: false })
    .limit(cap * 3) // over-fetch; freemium token filters applied in-process for mixed subjects

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

  let rows = (data ?? []).map((r) => rowToUnifiedSignal(r as Record<string, unknown>))

  rows = rows.filter((sig) => {
    if (sig.dropped || sig.sample) return false

    if (sig.subjectType === 'token') {
      if (effective.minSourceCount && (sig.sourceCount ?? 0) < effective.minSourceCount) {
        return false
      }
      if (effective.minVerdict) {
        const order = { scanning: 0, 'n/a': 0, safe: 1, caution: 2, danger: 3 } as const
        if (order[sig.verdict] < order[effective.minVerdict]) return false
      }
    }

    if (effective.search) {
      const s = effective.search
      const hay = [
        sig.label,
        sig.tokenSymbol,
        sig.contractAddress,
        sig.matchId,
        sig.teams?.home,
        sig.teams?.away,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(s)) return false
    }

    return true
  })

  return rows.slice(0, cap)
}
