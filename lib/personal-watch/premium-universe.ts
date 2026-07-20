import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveConsumerTier } from '@/lib/billing/consumer-tier'
import type { MintUniverse } from './mint-universe'

function consumerIsPremium(tier: string): boolean {
  return tier === 'pro' || tier === 'elite' || tier === 'enterprise' || tier === 'micropack'
}

/** Cached premium user ids — refreshed every 5 min to avoid N×tier lookups per tick. */
let premiumCache: { at: number; ids: Set<string> } | null = null
const PREMIUM_CACHE_MS = 5 * 60_000

export async function resolvePremiumUserIds(userIds: Iterable<string>): Promise<Set<string>> {
  const unique = Array.from(new Set(userIds)).filter(Boolean)
  if (unique.length === 0) return new Set()

  const now = Date.now()
  if (premiumCache && now - premiumCache.at < PREMIUM_CACHE_MS) {
    const out = new Set<string>()
    for (const id of unique) {
      if (premiumCache.ids.has(id)) out.add(id)
    }
    return out
  }

  const premium = new Set<string>()
  const sb = getSupabaseAdmin()

  const { data: subs } = await sb
    .from('signal_subscription')
    .select('user_id, tier, premium_until')
    .in('user_id', unique)

  for (const row of subs ?? []) {
    const uid = String(row.user_id ?? '')
    if (!uid) continue
    if (row.tier === 'premium') {
      if (!row.premium_until || new Date(row.premium_until) > new Date()) {
        premium.add(uid)
      }
    }
  }

  for (const uid of unique) {
    if (premium.has(uid)) continue
    try {
      const consumer = await resolveConsumerTier(uid)
      if (consumerIsPremium(consumer)) premium.add(uid)
    } catch {
      /* skip */
    }
  }

  premiumCache = { at: now, ids: premium }
  return premium
}

/** Mint universe restricted to mints watched/held by at least one premium user. */
export async function filterPremiumMintUniverse(universe: MintUniverse): Promise<{
  mintToUsers: Map<string, Set<string>>
  heldMints: Set<string>
  premiumUserCount: number
}> {
  const allUsers = new Set<string>()
  for (const users of universe.mintToUsers.values()) {
    for (const u of users) allUsers.add(u)
  }
  const premiumUsers = await resolvePremiumUserIds(allUsers)

  const mintToUsers = new Map<string, Set<string>>()
  const heldMints = new Set<string>()

  for (const [mint, users] of universe.mintToUsers) {
    const filtered = new Set<string>()
    for (const u of users) {
      if (premiumUsers.has(u)) filtered.add(u)
    }
    if (filtered.size === 0) continue
    mintToUsers.set(mint, filtered)
    if (universe.heldMints.has(mint)) heldMints.add(mint)
  }

  return { mintToUsers, heldMints, premiumUserCount: premiumUsers.size }
}
