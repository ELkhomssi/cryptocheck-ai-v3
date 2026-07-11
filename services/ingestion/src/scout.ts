/**
 * AI Signal Source Agent (multi-platform)
 * ---------------------------------------
 * Automates discovery + enrollment of high-quality PUBLIC signal sources across
 * platforms (Telegram, X/Twitter, …) so operators never hand-curate the
 * allowlist.
 *
 * Per platform the pipeline is identical and source-agnostic:
 *   gather candidates (curated seed list + optional external search API) →
 *   quality gate (audience size / reputation / verification) →
 *   dedup against Supabase (per platform) → enroll new sources (enabled=true).
 *
 * Backend only. No UI. Respects hygiene rules: PUBLIC accounts only, no
 * private/invite links, no paid scraping.
 *
 * Audience figures on curated seeds are APPROXIMATE public numbers used to drive
 * the quality gate; they are never persisted as user-facing metrics or emitted
 * as signals. Rows live in the (legacy-named) `telegram_channels` table, now
 * carrying a `platform` column.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isPublicChannelRef, normalizeChannelRef } from './config.js'
import { passesDiscoveryHygiene } from './discovery/scam-heuristics.js'
import { resolveSupabaseAdminCreds } from './lib/supabase-creds.js'

export type SourcePlatform = 'telegram' | 'twitter'

export type SourceCandidate = {
  handle: string
  label?: string
  /** Subscribers (telegram) or followers (twitter) — approximate, gate input only. */
  audienceSize?: number
  /** Simulated reputation score 0..100. */
  reputationScore?: number
  /** Trust signals behind inclusion (verified badge, top-ranked, official, …). */
  verifiedBy?: string[]
}

export type PlatformScoutConfig = {
  platform: SourcePlatform
  enabled: boolean
  /** Min subscribers (telegram) / followers (twitter). */
  minAudience: number
  minReputation: number
  requireVerification: boolean
  audienceLabel: string
  curated: SourceCandidate[]
  searchApiUrl: string
  searchApiKey: string
}

export type ScoutConfig = {
  enabled: boolean
  dryRun: boolean
  maxInsertsPerRun: number
  platforms: PlatformScoutConfig[]
}

export type PlatformScoutResult = {
  platform: SourcePlatform
  candidatesConsidered: number
  passedFilter: number
  alreadyPresent: number
  inserted: number
  insertedHandles: string[]
  skipped: boolean
  reason?: string
}

export type ScoutResult = {
  totalInserted: number
  platforms: PlatformScoutResult[]
  skipped: boolean
  reason?: string
}

/**
 * Real, well-known PUBLIC Telegram channels. Subscriber counts are approximate
 * public figures (research July 2026); reputation is heuristic.
 */
export const TELEGRAM_SOURCES: SourceCandidate[] = [
  { handle: '@watcherguru', label: 'Watcher Guru', audienceSize: 627_000, reputationScore: 95, verifiedBy: ['telegram-verified', 'tgstat-top-ranked'] },
  { handle: '@money', label: 'Money · Crypto & Finance', audienceSize: 4_268_000, reputationScore: 90, verifiedBy: ['tgstat-top-ranked'] },
  { handle: '@just', label: 'Just News', audienceSize: 3_790_000, reputationScore: 88, verifiedBy: ['telegram-verified', 'tgstat-top-ranked'] },
  { handle: '@binance_announcements', label: 'Binance Announcements', audienceSize: 4_585_000, reputationScore: 93, verifiedBy: ['telegram-verified', 'exchange-official'] },
  { handle: '@toncoin', label: 'Toncoin', audienceSize: 7_689_000, reputationScore: 87, verifiedBy: ['tgstat-top-ranked', 'project-official'] },
  { handle: '@coinlistofficialchannel', label: 'CoinList Official', audienceSize: 40_000, reputationScore: 85, verifiedBy: ['platform-official'] },
  { handle: '@Whale_Alert', label: 'Whale Alert', audienceSize: 13_400, reputationScore: 92, verifiedBy: ['on-chain-tracker'] },
  // Solana / DEX surfaces that more often include resolvable mint links
  { handle: '@solana', label: 'Solana', audienceSize: 500_000, reputationScore: 90, verifiedBy: ['project-official'] },
  { handle: '@RaydiumProtocol', label: 'Raydium', audienceSize: 100_000, reputationScore: 86, verifiedBy: ['dex-official'] },
  { handle: '@JupiterExchange', label: 'Jupiter Exchange', audienceSize: 100_000, reputationScore: 88, verifiedBy: ['dex-official'] },
]

/**
 * Real, well-known PUBLIC X (Twitter) alpha sources — major DEXs, launchpads,
 * top analysts and project/exchange accounts. Follower counts are approximate
 * public figures (research July 2026); reputation is heuristic.
 */
export const TWITTER_SOURCES: SourceCandidate[] = [
  // Exchanges / founders
  { handle: '@cz_binance', label: 'CZ (Binance)', audienceSize: 9_000_000, reputationScore: 94, verifiedBy: ['twitter-verified', 'exchange-official'] },
  { handle: '@VitalikButerin', label: 'Vitalik Buterin', audienceSize: 5_600_000, reputationScore: 96, verifiedBy: ['twitter-verified', 'project-official'] },
  { handle: '@solana', label: 'Solana', audienceSize: 3_200_000, reputationScore: 90, verifiedBy: ['twitter-verified', 'project-official'] },
  { handle: '@aeyakovenko', label: 'Anatoly Yakovenko (Solana)', audienceSize: 800_000, reputationScore: 89, verifiedBy: ['twitter-verified', 'project-official'] },
  // DEXs
  { handle: '@Uniswap', label: 'Uniswap', audienceSize: 1_300_000, reputationScore: 90, verifiedBy: ['twitter-verified', 'dex-official'] },
  { handle: '@JupiterExchange', label: 'Jupiter (Solana DEX)', audienceSize: 700_000, reputationScore: 88, verifiedBy: ['twitter-verified', 'dex-official'] },
  { handle: '@RaydiumProtocol', label: 'Raydium', audienceSize: 600_000, reputationScore: 85, verifiedBy: ['twitter-verified', 'dex-official'] },
  // Launchpads
  { handle: '@pumpdotfun', label: 'Pump.fun', audienceSize: 800_000, reputationScore: 84, verifiedBy: ['twitter-verified', 'launchpad-official'] },
  // Analysts / on-chain
  { handle: '@lookonchain', label: 'Lookonchain', audienceSize: 1_000_000, reputationScore: 91, verifiedBy: ['twitter-verified', 'on-chain-tracker'] },
  { handle: '@WatcherGuru', label: 'Watcher Guru', audienceSize: 2_500_000, reputationScore: 92, verifiedBy: ['twitter-verified', 'top-analyst'] },
  { handle: '@0xMert_', label: 'Mert (Helius)', audienceSize: 400_000, reputationScore: 86, verifiedBy: ['twitter-verified', 'top-analyst'] },
  { handle: '@APompliano', label: 'Anthony Pompliano', audienceSize: 1_700_000, reputationScore: 85, verifiedBy: ['twitter-verified', 'top-analyst'] },
]

function bool(v: string | undefined, dflt: boolean): boolean {
  const t = v?.trim().toLowerCase()
  if (t === undefined || t === '') return dflt
  return t === '1' || t === 'true' || t === 'yes'
}
function num(v: string | undefined, dflt: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : dflt
}

function loadTelegramSeedFile(): SourceCandidate[] {
  const rel =
    process.env.SCOUT_TELEGRAM_SEEDS_PATH?.trim() ||
    'config/telegram-discovery-seeds.json'
  const path = resolve(process.cwd(), rel)
  // Docker WORKDIR is /app; seeds ship under services/ingestion/config
  const fallback = resolve(process.cwd(), 'services/ingestion/config/telegram-discovery-seeds.json')
  for (const p of [path, fallback, resolve(process.cwd(), 'config/telegram-discovery-seeds.json')]) {
    try {
      const raw = readFileSync(p, 'utf8')
      const parsed = JSON.parse(raw) as { channels?: unknown }
      if (!Array.isArray(parsed.channels)) continue
      const out: SourceCandidate[] = []
      for (const item of parsed.channels) {
        if (!item || typeof item !== 'object') continue
        const rec = item as Record<string, unknown>
        if (typeof rec.handle !== 'string') continue
        out.push({
          handle: normalizeChannelRef(rec.handle),
          label: typeof rec.label === 'string' ? rec.label : undefined,
          audienceSize: typeof rec.audienceSize === 'number' ? rec.audienceSize : undefined,
          reputationScore: typeof rec.reputationScore === 'number' ? rec.reputationScore : 75,
          verifiedBy: ['discovery-seed'],
        })
      }
      if (out.length > 0) {
        console.info('[scout] loaded telegram discovery seeds', { path: p, count: out.length })
        return out
      }
    } catch {
      /* try next path */
    }
  }
  return []
}

export function loadScoutConfig(): ScoutConfig {
  // Scale defaults: large seed file + room to enroll toward 1k when search API is set.
  // GramJS join FloodWait still caps concurrent listens — use SIGNAL_CHANNEL_MAX_LISTEN + session sharding.
  const globalMinReputation = num(process.env.SCOUT_MIN_REPUTATION, 70)
  const seedFile = loadTelegramSeedFile()
  const telegramCurated = (() => {
    const map = new Map<string, SourceCandidate>()
    for (const c of [...TELEGRAM_SOURCES, ...seedFile]) {
      const k = normalizeChannelRef(c.handle).toLowerCase()
      map.set(k, { ...map.get(k), ...c, handle: normalizeChannelRef(c.handle) })
    }
    return [...map.values()]
  })()

  const telegram: PlatformScoutConfig = {
    platform: 'telegram',
    enabled: bool(process.env.SCOUT_TELEGRAM_ENABLED, true),
    minAudience: num(process.env.SCOUT_MIN_SUBSCRIBERS, 5_000),
    minReputation: num(process.env.SCOUT_TELEGRAM_MIN_REPUTATION, globalMinReputation),
    requireVerification: bool(
      process.env.SCOUT_TELEGRAM_REQUIRE_VERIFICATION ?? process.env.SCOUT_REQUIRE_VERIFICATION,
      false,
    ),
    audienceLabel: 'subscribers',
    curated: telegramCurated,
    searchApiUrl:
      process.env.SCOUT_TELEGRAM_SEARCH_API_URL?.trim() || process.env.SCOUT_SEARCH_API_URL?.trim() || '',
    searchApiKey:
      process.env.SCOUT_TELEGRAM_SEARCH_API_KEY?.trim() || process.env.SCOUT_SEARCH_API_KEY?.trim() || '',
  }

  const twitter: PlatformScoutConfig = {
    platform: 'twitter',
    enabled: bool(process.env.SCOUT_TWITTER_ENABLED, false),
    minAudience: num(process.env.SCOUT_MIN_FOLLOWERS, 100_000),
    minReputation: num(process.env.SCOUT_TWITTER_MIN_REPUTATION, globalMinReputation),
    requireVerification: bool(process.env.SCOUT_TWITTER_REQUIRE_VERIFICATION, true),
    audienceLabel: 'followers',
    curated: TWITTER_SOURCES,
    searchApiUrl: process.env.SCOUT_TWITTER_SEARCH_API_URL?.trim() || '',
    searchApiKey: process.env.SCOUT_TWITTER_SEARCH_API_KEY?.trim() || '',
  }

  return {
    enabled: bool(process.env.SCOUT_ENABLED, true),
    dryRun: bool(process.env.SCOUT_DRY_RUN, false),
    maxInsertsPerRun: num(process.env.SCOUT_MAX_INSERTS, 250),
    platforms: [telegram, twitter],
  }
}

/**
 * Optional external discovery hook. If a platform's search API is configured we
 * fetch extra candidates. The endpoint returns { channels|sources: SourceCandidate[] }
 * or a bare array. Failures are non-fatal — curated seeds still run.
 */
async function fetchFromSearchApi(pc: PlatformScoutConfig): Promise<SourceCandidate[]> {
  if (!pc.searchApiUrl) return []
  try {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (pc.searchApiKey) headers.authorization = `Bearer ${pc.searchApiKey}`
    const res = await fetch(pc.searchApiUrl, { headers, cache: 'no-store' })
    if (!res.ok) {
      console.warn('[scout] search API non-OK', { platform: pc.platform, status: res.status })
      return []
    }
    const body = (await res.json()) as Record<string, unknown> | unknown
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray((body as { sources?: unknown }).sources)
        ? (body as { sources: unknown[] }).sources
        : Array.isArray((body as { channels?: unknown }).channels)
          ? (body as { channels: unknown[] }).channels
          : []
    const out: SourceCandidate[] = []
    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const handle = typeof rec.handle === 'string' ? rec.handle : typeof rec.username === 'string' ? rec.username : ''
      if (!handle) continue
      const audienceSize =
        typeof rec.audienceSize === 'number'
          ? rec.audienceSize
          : typeof rec.followers === 'number'
            ? rec.followers
            : typeof rec.subscribers === 'number'
              ? rec.subscribers
              : undefined
      out.push({
        handle,
        label: typeof rec.label === 'string' ? rec.label : undefined,
        audienceSize,
        reputationScore: typeof rec.reputationScore === 'number' ? rec.reputationScore : undefined,
        verifiedBy: Array.isArray(rec.verifiedBy) ? (rec.verifiedBy as string[]) : undefined,
      })
    }
    console.info('[scout] search API candidates', { platform: pc.platform, count: out.length })
    return out
  } catch (e) {
    console.warn('[scout] search API error', { platform: pc.platform, error: e instanceof Error ? e.message : e })
    return []
  }
}

/** Audience / reputation / verification quality gate. Simulated but tunable. */
export function passesQualityFilter(c: SourceCandidate, pc: PlatformScoutConfig): boolean {
  const ref = normalizeChannelRef(c.handle)
  if (!isPublicChannelRef(ref)) return false
  if (pc.requireVerification && (!c.verifiedBy || c.verifiedBy.length === 0)) return false
  if ((c.reputationScore ?? 0) < pc.minReputation) return false
  if ((c.audienceSize ?? 0) < pc.minAudience) return false
  return true
}

function supabaseCreds(): { url: string; key: string } | null {
  return resolveSupabaseAdminCreds()
}

/** Existing handles grouped by platform (normalized + lowercased). */
async function fetchExistingByPlatform(url: string, key: string): Promise<Map<SourcePlatform, Set<string>>> {
  const out = new Map<SourcePlatform, Set<string>>([
    ['telegram', new Set()],
    ['twitter', new Set()],
  ])
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  // Prefer platform-aware query; fall back if the column doesn't exist yet.
  let rows: { username?: string; platform?: string }[] | null = null
  const withPlatform = await fetch(`${url}/rest/v1/telegram_channels?select=username,platform`, {
    headers,
    cache: 'no-store',
  })
  if (withPlatform.ok) {
    rows = (await withPlatform.json()) as { username?: string; platform?: string }[]
  } else {
    const legacy = await fetch(`${url}/rest/v1/telegram_channels?select=username`, { headers, cache: 'no-store' })
    if (!legacy.ok) throw new Error(`Supabase list failed HTTP ${legacy.status}`)
    rows = (await legacy.json()) as { username?: string }[]
  }

  for (const r of rows) {
    if (typeof r.username !== 'string') continue
    const platform = (r.platform === 'twitter' ? 'twitter' : 'telegram') as SourcePlatform
    out.get(platform)!.add(normalizeChannelRef(r.username).toLowerCase())
  }
  return out
}

async function insertSources(
  url: string,
  key: string,
  rows: { platform: SourcePlatform; username: string; enabled: boolean; label?: string }[],
): Promise<number> {
  if (rows.length === 0) return 0
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=ignore-duplicates,return=representation',
  }

  // Prefer platform-aware upsert; fall back when 20260708_source_platform.sql is not applied.
  const withPlatform = await fetch(`${url}/rest/v1/telegram_channels?on_conflict=platform,username`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  })
  if (withPlatform.ok) {
    const inserted = (await withPlatform.json()) as unknown[]
    return Array.isArray(inserted) ? inserted.length : rows.length
  }

  const legacyRows = rows
    .filter((r) => r.platform === 'telegram')
    .map(({ username, enabled, label }) => ({ username, enabled, label }))
  if (legacyRows.length === 0) {
    throw new Error(`Supabase insert failed HTTP ${withPlatform.status}: platform column missing and no telegram rows`)
  }

  const legacy = await fetch(`${url}/rest/v1/telegram_channels?on_conflict=username`, {
    method: 'POST',
    headers,
    body: JSON.stringify(legacyRows),
  })
  if (!legacy.ok) {
    const text = await legacy.text()
    throw new Error(`Supabase insert failed HTTP ${legacy.status}: ${text.slice(0, 200)}`)
  }
  const inserted = (await legacy.json()) as unknown[]
  return Array.isArray(inserted) ? inserted.length : legacyRows.length
}

async function scoutPlatform(
  pc: PlatformScoutConfig,
  existing: Set<string>,
  creds: { url: string; key: string },
  cfg: ScoutConfig,
): Promise<PlatformScoutResult> {
  // 1. Gather (curated + optional external search).
  const fromApi = await fetchFromSearchApi(pc)
  const merged = new Map<string, SourceCandidate>()
  for (const c of [...pc.curated, ...fromApi]) {
    const norm = normalizeChannelRef(c.handle)
    const klc = norm.toLowerCase()
    merged.set(klc, { ...merged.get(klc), ...c, handle: norm })
  }
  const candidates = [...merged.values()]

  // 2. Quality gate + scam/hygiene filter.
  const qualified = candidates.filter((c) => {
    if (!passesQualityFilter(c, pc)) return false
    if (pc.platform !== 'telegram') return true
    const hygiene = passesDiscoveryHygiene({
      handle: c.handle,
      label: c.label,
      audienceSize: c.audienceSize,
      minAudience: pc.minAudience,
    })
    if (!hygiene.ok) {
      console.info('[scout] hygiene reject', { handle: c.handle, reason: hygiene.reason })
      return false
    }
    return true
  })

  // 3. Dedup + cap.
  const fresh = qualified.filter((c) => !existing.has(normalizeChannelRef(c.handle).toLowerCase()))
  const toInsert = fresh.slice(0, cfg.maxInsertsPerRun)

  const base: PlatformScoutResult = {
    platform: pc.platform,
    candidatesConsidered: candidates.length,
    passedFilter: qualified.length,
    alreadyPresent: qualified.length - fresh.length,
    inserted: 0,
    insertedHandles: toInsert.map((c) => normalizeChannelRef(c.handle)),
    skipped: false,
  }

  if (cfg.dryRun) return { ...base, inserted: 0, skipped: true, reason: 'dry-run' }

  // 4. Enroll.
  if (toInsert.length > 0) {
    try {
      base.inserted = await insertSources(
        creds.url,
        creds.key,
        toInsert.map((c) => ({
          platform: pc.platform,
          username: normalizeChannelRef(c.handle),
          enabled: true,
          label: c.label,
        })),
      )
    } catch (e) {
      return { ...base, inserted: 0, insertedHandles: [], skipped: false, reason: e instanceof Error ? e.message : 'insert failed' }
    }
  }
  return base
}

/**
 * Discover + enroll new sources across all enabled platforms. Idempotent
 * (dedup + ignore-duplicates). Non-throwing on config gaps so boot is never
 * blocked.
 */
export async function runChannelScout(cfg: ScoutConfig = loadScoutConfig()): Promise<ScoutResult> {
  if (!cfg.enabled) return { totalInserted: 0, platforms: [], skipped: true, reason: 'SCOUT_ENABLED=false' }

  const creds = supabaseCreds()
  if (!creds) {
    return { totalInserted: 0, platforms: [], skipped: true, reason: 'missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY' }
  }

  let existing: Map<SourcePlatform, Set<string>>
  try {
    existing = await fetchExistingByPlatform(creds.url, creds.key)
  } catch (e) {
    return { totalInserted: 0, platforms: [], skipped: true, reason: e instanceof Error ? e.message : 'list failed' }
  }

  const results: PlatformScoutResult[] = []
  for (const pc of cfg.platforms) {
    if (!pc.enabled) {
      results.push({
        platform: pc.platform,
        candidatesConsidered: 0,
        passedFilter: 0,
        alreadyPresent: 0,
        inserted: 0,
        insertedHandles: [],
        skipped: true,
        reason: 'platform disabled',
      })
      continue
    }
    results.push(await scoutPlatform(pc, existing.get(pc.platform) ?? new Set(), creds, cfg))
  }

  return {
    totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
    platforms: results,
    skipped: false,
  }
}

/** Standalone entrypoint for `node dist/scout.js` (cron) — logs a summary. */
async function main(): Promise<void> {
  const { config } = await import('dotenv')
  const { dirname, resolve } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  config({ path: resolve(repoRoot, '.env.local') })
  config({ path: resolve(repoRoot, '.env') })
  config()
  if (!process.env.SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
  }
  const result = await runChannelScout()
  console.info('[scout] run complete', JSON.stringify(result, null, 2))
  process.exit(0)
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && /(?:^|[\\/])scout\.(?:js|ts)$/.test(process.argv[1])
if (invokedDirectly) {
  void main().catch((e) => {
    console.error('[scout] fatal', e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
