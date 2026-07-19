import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type MintUniverse = {
  /** mint → userIds who watch or hold */
  mintToUsers: Map<string, Set<string>>
  /** mint → true if any linked user holds it (portfolio snapshot), else watchlist-only */
  heldMints: Set<string>
  watchlistRows: number
  portfolioMints: number
}

function addMint(
  map: Map<string, Set<string>>,
  mint: string,
  userId: string,
): void {
  const m = mint.trim()
  if (m.length < 32 || !userId) return
  let set = map.get(m)
  if (!set) {
    set = new Set()
    map.set(m, set)
  }
  set.add(userId)
}

/**
 * UNION of watchlist mints + mints in recent portfolio_snapshots.
 * Deduplicated by mint — one scan target regardless of how many users watch it.
 */
export async function collectMintUniverse(): Promise<MintUniverse> {
  const sb = getSupabaseAdmin()
  const mintToUsers = new Map<string, Set<string>>()
  const heldMints = new Set<string>()
  let watchlistRows = 0
  let portfolioMints = 0

  const { data: watchRows, error: wErr } = await sb
    .from('watchlist')
    .select('user_id, mint')
  if (wErr) {
    console.error('[personal-watch] watchlist read', wErr.message)
  } else {
    for (const row of watchRows ?? []) {
      watchlistRows++
      addMint(mintToUsers, String(row.mint ?? ''), String(row.user_id ?? ''))
    }
  }

  // Latest snapshot per user (cap lookback).
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: snaps, error: pErr } = await sb
    .from('portfolio_snapshots')
    .select('user_id, snapshot_data, scanned_at')
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: false })
    .limit(500)

  if (pErr) {
    console.error('[personal-watch] portfolio_snapshots read', pErr.message)
  } else {
    const seenUser = new Set<string>()
    for (const row of snaps ?? []) {
      const uid = String(row.user_id ?? '')
      if (!uid || seenUser.has(uid)) continue
      seenUser.add(uid)
      const data = row.snapshot_data
      const holdings = Array.isArray(data) ? data : []
      for (const h of holdings) {
        const mint =
          h && typeof h === 'object' && typeof (h as { mint?: unknown }).mint === 'string'
            ? (h as { mint: string }).mint
            : ''
        if (mint.length < 32) continue
        portfolioMints++
        heldMints.add(mint.trim())
        addMint(mintToUsers, mint, uid)
      }
    }
  }

  return { mintToUsers, heldMints, watchlistRows, portfolioMints }
}
