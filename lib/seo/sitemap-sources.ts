import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { SITEMAP_URL_LIMIT } from '@/lib/seo/site'

export type SitemapEntry = {
  locPath: string
  lastmod: string
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

function toIso(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return fallback
}

function isPlausibleMint(mint: string): boolean {
  return mint.length >= 32 && mint.length <= 64 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(mint)
}

function isPlausibleWallet(address: string): boolean {
  return address.length >= 32 && address.length <= 64 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Distinct indexed mints from watch snapshots + scan history.
 * New rows appear on the next sitemap revalidation — no manual rebuild.
 */
export async function fetchIndexedTokenEntries(opts?: {
  offset?: number
  limit?: number
}): Promise<SitemapEntry[]> {
  const offset = opts?.offset ?? 0
  const limit = Math.min(opts?.limit ?? SITEMAP_URL_LIMIT, SITEMAP_URL_LIMIT)
  const byMint = new Map<string, SitemapEntry>()

  try {
    const sb = getSupabaseAdmin()

    const { data: snaps } = await sb
      .from('token_watch_snapshots')
      .select('mint, updated_at, scanned_at')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    for (const row of snaps ?? []) {
      const mint = typeof row.mint === 'string' ? row.mint.trim() : ''
      if (!isPlausibleMint(mint)) continue
      byMint.set(mint, {
        locPath: `/token/${mint}`,
        lastmod: toIso(row.updated_at ?? row.scanned_at),
        changefreq: 'daily',
        priority: 0.9,
      })
    }

    if (byMint.size < limit) {
      const need = limit - byMint.size
      const { data: hist } = await sb
        .from('scan_history')
        .select('mint_address, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(need * 3, 15_000))

      for (const row of hist ?? []) {
        if (byMint.size >= limit) break
        const mint = typeof row.mint_address === 'string' ? row.mint_address.trim() : ''
        if (!isPlausibleMint(mint) || byMint.has(mint)) continue
        byMint.set(mint, {
          locPath: `/token/${mint}`,
          lastmod: toIso(row.created_at),
          changefreq: 'daily',
          priority: 0.9,
        })
      }
    }
  } catch (err) {
    console.error('[seo] fetchIndexedTokenEntries', err)
  }

  return [...byMint.values()]
}

export async function countIndexedTokensApprox(): Promise<number> {
  try {
    const sb = getSupabaseAdmin()
    const { count: snapCount } = await sb
      .from('token_watch_snapshots')
      .select('mint', { count: 'exact', head: true })
    if (typeof snapCount === 'number' && snapCount > 0) return snapCount

    const { count: histCount } = await sb
      .from('scan_history')
      .select('id', { count: 'exact', head: true })
    return histCount ?? 0
  } catch {
    return 0
  }
}

export async function fetchIndexedWalletEntries(opts?: {
  offset?: number
  limit?: number
}): Promise<SitemapEntry[]> {
  const offset = opts?.offset ?? 0
  const limit = Math.min(opts?.limit ?? SITEMAP_URL_LIMIT, SITEMAP_URL_LIMIT)
  const entries: SitemapEntry[] = []

  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('smart_money_wallets')
      .select('address, last_active_at, created_at')
      .eq('active', true)
      .order('historical_pnl_usd', { ascending: false })
      .range(offset, offset + limit - 1)

    for (const row of data ?? []) {
      const address = typeof row.address === 'string' ? row.address.trim() : ''
      if (!isPlausibleWallet(address)) continue
      entries.push({
        locPath: `/wallet/${address}`,
        lastmod: toIso(row.last_active_at ?? row.created_at),
        changefreq: 'weekly',
        priority: 0.8,
      })
    }

    // Secondary source: tracked trading wallets
    if (entries.length < limit) {
      const need = limit - entries.length
      const seen = new Set(entries.map((e) => e.locPath))
      const { data: tracked } = await sb
        .from('trading_os_tracked_wallets')
        .select('wallet, updated_at, last_trade_at')
        .order('updated_at', { ascending: false })
        .limit(need)

      for (const row of tracked ?? []) {
        const address = typeof row.wallet === 'string' ? row.wallet.trim() : ''
        if (!isPlausibleWallet(address)) continue
        const locPath = `/wallet/${address}`
        if (seen.has(locPath)) continue
        seen.add(locPath)
        entries.push({
          locPath,
          lastmod: toIso(row.updated_at ?? row.last_trade_at),
          changefreq: 'weekly',
          priority: 0.75,
        })
        if (entries.length >= limit) break
      }
    }
  } catch (err) {
    console.error('[seo] fetchIndexedWalletEntries', err)
  }

  return entries
}

export async function countIndexedWalletsApprox(): Promise<number> {
  try {
    const sb = getSupabaseAdmin()
    const { count } = await sb
      .from('smart_money_wallets')
      .select('address', { count: 'exact', head: true })
      .eq('active', true)
    return count ?? 0
  } catch {
    return 0
  }
}

export async function fetchIndexedReportEntries(opts?: {
  offset?: number
  limit?: number
}): Promise<SitemapEntry[]> {
  const offset = opts?.offset ?? 0
  const limit = Math.min(opts?.limit ?? SITEMAP_URL_LIMIT, SITEMAP_URL_LIMIT)
  const entries: SitemapEntry[] = []

  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('reports')
      .select('id, created_at, title')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    for (const row of data ?? []) {
      const id = typeof row.id === 'string' ? row.id.trim() : ''
      if (!isUuid(id)) continue
      entries.push({
        locPath: `/report/${id}`,
        lastmod: toIso(row.created_at),
        changefreq: 'weekly',
        priority: 0.7,
      })
    }
  } catch (err) {
    console.error('[seo] fetchIndexedReportEntries', err)
  }

  return entries
}

export async function countIndexedReportsApprox(): Promise<number> {
  try {
    const sb = getSupabaseAdmin()
    const { count } = await sb.from('reports').select('id', { count: 'exact', head: true })
    return count ?? 0
  } catch {
    return 0
  }
}

export function sitemapPageCount(total: number, pageSize = SITEMAP_URL_LIMIT): number {
  if (total <= 0) return 1
  return Math.ceil(total / pageSize)
}
