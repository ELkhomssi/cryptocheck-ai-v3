import { Redis } from '@upstash/redis'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const LIST_KEY = 'cc:pulse:institutional'
const MAX = 10

export type PulseEntry = {
  mint: string
  aggregateScore: number
  verdict: string
  institutionalGrade: string
  ts: string
}

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

/** Push a completed institutional-grade scan to the global Pulse feed (last 10). */
export async function pushPulseEntry(entry: PulseEntry): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.lpush(LIST_KEY, JSON.stringify(entry))
    await r.ltrim(LIST_KEY, 0, MAX - 1)
  } catch (e) {
    console.warn('[pulse-feed] push failed', e)
  }
}

export async function getPulseFeed(): Promise<PulseEntry[]> {
  const dbRows = await getRecentDistinctScansFromDb()
  if (dbRows.length > 0) return dbRows

  const r = getRedis()
  if (!r) {
    return getDefaultPulseMock()
  }
  try {
    const rows = await r.lrange<string>(LIST_KEY, 0, MAX - 1)
    if (!rows?.length) return getDefaultPulseMock()
    const parsed = rows
      .map((raw) => {
        try {
          return typeof raw === 'string' ? (JSON.parse(raw) as PulseEntry) : (raw as PulseEntry)
        } catch {
          return null
        }
      })
      .filter(Boolean) as PulseEntry[]
    return dedupeByMint(parsed)
  } catch {
    return getDefaultPulseMock()
  }
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 78) return 'B+'
  if (score >= 72) return 'B'
  if (score >= 62) return 'C+'
  if (score >= 52) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

function normalizeVerdict(verdict: string | null): string {
  const v = String(verdict || '').toUpperCase()
  if (v === 'SAFE' || v === 'CAUTION' || v === 'DANGER' || v === 'RISKY') return v
  return 'UNKNOWN'
}

function dedupeByMint(rows: PulseEntry[]): PulseEntry[] {
  const seen = new Set<string>()
  const out: PulseEntry[] = []
  for (const row of rows) {
    if (!row.mint || seen.has(row.mint)) continue
    seen.add(row.mint)
    out.push(row)
    if (out.length >= MAX) break
  }
  return out
}

async function getRecentDistinctScansFromDb(): Promise<PulseEntry[]> {
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('scan_history')
      .select('mint_address, risk_score, verdict, created_at')
      .not('verdict', 'is', null)
      .order('created_at', { ascending: false })
      .limit(120)

    if (error || !data || data.length === 0) return []

    const mapped = data
      .map((row) => {
        const mint = typeof row.mint_address === 'string' ? row.mint_address.trim() : ''
        const score = typeof row.risk_score === 'number' && Number.isFinite(row.risk_score) ? row.risk_score : null
        const ts = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString()
        if (!mint || score == null) return null
        return {
          mint,
          aggregateScore: Math.max(0, Math.min(100, Math.round(score))),
          verdict: normalizeVerdict(row.verdict),
          institutionalGrade: scoreToGrade(score),
          ts,
        } satisfies PulseEntry
      })
      .filter(Boolean) as PulseEntry[]

    return dedupeByMint(mapped)
  } catch {
    return []
  }
}

function getDefaultPulseMock(): PulseEntry[] {
  const now = Date.now()
  return [
    { mint: 'EPjF…TDt1v', aggregateScore: 88, verdict: 'SAFE', institutionalGrade: 'A', ts: new Date(now - 120_000).toISOString() },
    { mint: 'So11…11112', aggregateScore: 82, verdict: 'SAFE', institutionalGrade: 'B+', ts: new Date(now - 340_000).toISOString() },
    { mint: '7vfC…UXQt', aggregateScore: 61, verdict: 'CAUTION', institutionalGrade: 'C+', ts: new Date(now - 900_000).toISOString() },
  ]
}
