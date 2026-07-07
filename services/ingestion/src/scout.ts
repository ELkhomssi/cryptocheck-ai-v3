/**
 * AI Channel Scout Agent
 * ----------------------
 * Automates discovery of high-quality PUBLIC Telegram alpha channels so operators
 * never hand-curate the `telegram_channels` allowlist.
 *
 * Pipeline: gather candidates (curated elite list + optional search API) →
 * quality filter (reputation / subscribers / aggregator verification) →
 * dedup against Supabase → insert new rows with `enabled = true`.
 *
 * Backend only. No UI. Respects TELEGRAM HYGIENE: public channels only, no
 * private/invite links, no paid scraping.
 *
 * The reputation / subscriber numbers on curated candidates are HEURISTIC SEED
 * metadata used solely to drive the quality gate — they are never persisted as
 * user-facing metrics or emitted as signals.
 */
import { isPublicChannelRef, normalizeChannelRef } from './config.js'

export type ScoutCandidate = {
  username: string
  label?: string
  /** Heuristic subscriber estimate — quality-gate input only, not a displayed metric. */
  estSubscribers?: number
  /** Simulated reputation score 0..100 from "smart money" aggregators. */
  reputationScore?: number
  /** Simulated aggregator attestations (e.g. which trackers flag this as top alpha). */
  verifiedBy?: string[]
}

export type ScoutConfig = {
  enabled: boolean
  dryRun: boolean
  minReputation: number
  minSubscribers: number
  requireAggregatorVerification: boolean
  searchApiUrl: string
  searchApiKey: string
  maxInsertsPerRun: number
}

export type ScoutResult = {
  candidatesConsidered: number
  passedFilter: number
  alreadyPresent: number
  inserted: number
  insertedUsernames: string[]
  skipped: boolean
  reason?: string
}

/**
 * Curated "Elite Crypto Alpha" seed list — well-known PUBLIC channels frequently
 * cited by traders. Reputation / subscriber values are heuristic seeds for the
 * quality gate only. Extend freely; the scout dedups on every run.
 */
export const ELITE_ALPHA_CHANNELS: ScoutCandidate[] = [
  {
    username: '@GemsMoonshot',
    label: 'Gems Moonshot',
    estSubscribers: 210_000,
    reputationScore: 88,
    verifiedBy: ['smart-money-aggregator', 'trader-consensus'],
  },
  {
    username: '@CryptoAlphaSignals',
    label: 'Crypto Alpha Signals',
    estSubscribers: 165_000,
    reputationScore: 84,
    verifiedBy: ['smart-money-aggregator'],
  },
  {
    username: '@WhaleAlertio',
    label: 'Whale Movements',
    estSubscribers: 340_000,
    reputationScore: 91,
    verifiedBy: ['smart-money-aggregator', 'on-chain-tracker'],
  },
  {
    username: '@DefiWhaleWatch',
    label: 'DeFi Whale Watch',
    estSubscribers: 128_000,
    reputationScore: 82,
    verifiedBy: ['on-chain-tracker'],
  },
  {
    username: '@SolanaAlphaCalls',
    label: 'Solana Alpha Calls',
    estSubscribers: 145_000,
    reputationScore: 86,
    verifiedBy: ['smart-money-aggregator', 'trader-consensus'],
  },
  {
    username: '@EarlyGemFinder',
    label: 'Early Gem Finder',
    estSubscribers: 98_000,
    reputationScore: 80,
    verifiedBy: ['trader-consensus'],
  },
  {
    username: '@SmartMoneyFlows',
    label: 'Smart Money Flows',
    estSubscribers: 175_000,
    reputationScore: 89,
    verifiedBy: ['smart-money-aggregator', 'on-chain-tracker'],
  },
  {
    username: '@AlphaHunterCalls',
    label: 'Alpha Hunter Calls',
    estSubscribers: 112_000,
    reputationScore: 83,
    verifiedBy: ['trader-consensus'],
  },
]

export function loadScoutConfig(): ScoutConfig {
  const bool = (v: string | undefined, dflt: boolean) => {
    const t = v?.trim().toLowerCase()
    if (t === undefined || t === '') return dflt
    return t === '1' || t === 'true' || t === 'yes'
  }
  const num = (v: string | undefined, dflt: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : dflt
  }
  return {
    enabled: bool(process.env.SCOUT_ENABLED, true),
    dryRun: bool(process.env.SCOUT_DRY_RUN, false),
    minReputation: num(process.env.SCOUT_MIN_REPUTATION, 80),
    minSubscribers: num(process.env.SCOUT_MIN_SUBSCRIBERS, 50_000),
    requireAggregatorVerification: bool(process.env.SCOUT_REQUIRE_VERIFICATION, true),
    searchApiUrl: process.env.SCOUT_SEARCH_API_URL?.trim() || '',
    searchApiKey: process.env.SCOUT_SEARCH_API_KEY?.trim() || '',
    maxInsertsPerRun: num(process.env.SCOUT_MAX_INSERTS, 25),
  }
}

/**
 * Optional external discovery hook. If SCOUT_SEARCH_API_URL is configured, we
 * fetch additional candidates. The endpoint is expected to return JSON shaped as
 * { channels: ScoutCandidate[] } or a bare ScoutCandidate[]. Failures are
 * non-fatal — the curated list still runs.
 */
async function fetchFromSearchApi(cfg: ScoutConfig): Promise<ScoutCandidate[]> {
  if (!cfg.searchApiUrl) return []
  try {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (cfg.searchApiKey) headers.authorization = `Bearer ${cfg.searchApiKey}`
    const res = await fetch(cfg.searchApiUrl, { headers, cache: 'no-store' })
    if (!res.ok) {
      console.warn('[scout] search API returned non-OK', { status: res.status })
      return []
    }
    const body = (await res.json()) as { channels?: unknown } | unknown
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray((body as { channels?: unknown }).channels)
        ? (body as { channels: unknown[] }).channels
        : []
    const out: ScoutCandidate[] = []
    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const username = typeof rec.username === 'string' ? rec.username : ''
      if (!username) continue
      out.push({
        username,
        label: typeof rec.label === 'string' ? rec.label : undefined,
        estSubscribers: typeof rec.estSubscribers === 'number' ? rec.estSubscribers : undefined,
        reputationScore: typeof rec.reputationScore === 'number' ? rec.reputationScore : undefined,
        verifiedBy: Array.isArray(rec.verifiedBy) ? (rec.verifiedBy as string[]) : undefined,
      })
    }
    console.info('[scout] fetched candidates from search API', { count: out.length })
    return out
  } catch (e) {
    console.warn('[scout] search API error', e instanceof Error ? e.message : e)
    return []
  }
}

/** Reputation / "Smart Money" quality gate. Simulated but tunable via env. */
export function passesQualityFilter(c: ScoutCandidate, cfg: ScoutConfig): boolean {
  const ref = normalizeChannelRef(c.username)
  if (!isPublicChannelRef(ref)) return false
  if (cfg.requireAggregatorVerification && (!c.verifiedBy || c.verifiedBy.length === 0)) return false
  if ((c.reputationScore ?? 0) < cfg.minReputation) return false
  if ((c.estSubscribers ?? 0) < cfg.minSubscribers) return false
  return true
}

function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

/** All usernames already in the table (any enabled state) — normalized + lowercased. */
async function fetchExistingUsernames(url: string, key: string): Promise<Set<string>> {
  const endpoint = `${url}/rest/v1/telegram_channels?select=username`
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Supabase list failed HTTP ${res.status}`)
  const rows = (await res.json()) as { username?: string }[]
  const set = new Set<string>()
  for (const r of rows) {
    if (typeof r.username === 'string') set.add(normalizeChannelRef(r.username).toLowerCase())
  }
  return set
}

async function insertChannels(
  url: string,
  key: string,
  rows: { username: string; enabled: boolean; label?: string }[],
): Promise<number> {
  if (rows.length === 0) return 0
  const endpoint = `${url}/rest/v1/telegram_channels?on_conflict=username`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // Ignore rows that race in as duplicates; return inserted rows so we can count.
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase insert failed HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const inserted = (await res.json()) as unknown[]
  return Array.isArray(inserted) ? inserted.length : rows.length
}

/**
 * Discover + enroll new alpha channels. Safe to run repeatedly (idempotent via
 * dedup + ignore-duplicates). Non-throwing on Supabase config gaps — returns a
 * skipped result so boot is never blocked.
 */
export async function runChannelScout(cfg: ScoutConfig = loadScoutConfig()): Promise<ScoutResult> {
  const empty: ScoutResult = {
    candidatesConsidered: 0,
    passedFilter: 0,
    alreadyPresent: 0,
    inserted: 0,
    insertedUsernames: [],
    skipped: true,
  }

  if (!cfg.enabled) return { ...empty, reason: 'SCOUT_ENABLED=false' }

  const creds = supabaseCreds()
  if (!creds) return { ...empty, reason: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }

  // 1. Gather candidates (curated + optional external search).
  const fromApi = await fetchFromSearchApi(cfg)
  const merged = new Map<string, ScoutCandidate>()
  for (const c of [...ELITE_ALPHA_CHANNELS, ...fromApi]) {
    const norm = normalizeChannelRef(c.username)
    const klc = norm.toLowerCase()
    const existing = merged.get(klc)
    // Prefer the richer record (search API may enrich curated seeds).
    merged.set(klc, { ...existing, ...c, username: norm })
  }
  const candidates = [...merged.values()]

  // 2. Quality filter.
  const qualified = candidates.filter((c) => passesQualityFilter(c, cfg))

  // 3. Dedup against Supabase.
  let existing: Set<string>
  try {
    existing = await fetchExistingUsernames(creds.url, creds.key)
  } catch (e) {
    return { ...empty, candidatesConsidered: candidates.length, reason: e instanceof Error ? e.message : 'list failed' }
  }

  const fresh = qualified.filter((c) => !existing.has(normalizeChannelRef(c.username).toLowerCase()))
  const toInsert = fresh.slice(0, cfg.maxInsertsPerRun)

  // 4. Insert (skipped on dry run — reports what it would enroll).
  let inserted = 0
  if (cfg.dryRun) {
    return {
      candidatesConsidered: candidates.length,
      passedFilter: qualified.length,
      alreadyPresent: qualified.length - fresh.length,
      inserted: 0,
      insertedUsernames: toInsert.map((c) => normalizeChannelRef(c.username)),
      skipped: true,
      reason: 'dry-run',
    }
  }
  if (toInsert.length > 0) {
    try {
      inserted = await insertChannels(
        creds.url,
        creds.key,
        toInsert.map((c) => ({
          username: normalizeChannelRef(c.username),
          enabled: true,
          label: c.label,
        })),
      )
    } catch (e) {
      return {
        candidatesConsidered: candidates.length,
        passedFilter: qualified.length,
        alreadyPresent: qualified.length - fresh.length,
        inserted: 0,
        insertedUsernames: [],
        skipped: false,
        reason: e instanceof Error ? e.message : 'insert failed',
      }
    }
  }

  return {
    candidatesConsidered: candidates.length,
    passedFilter: qualified.length,
    alreadyPresent: qualified.length - fresh.length,
    inserted,
    insertedUsernames: toInsert.map((c) => normalizeChannelRef(c.username)),
    skipped: false,
  }
}

/** Standalone entrypoint for `node dist/scout.js` (cron) — logs a summary. */
async function main(): Promise<void> {
  await import('dotenv/config')
  const result = await runChannelScout()
  console.info('[scout] run complete', result)
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
