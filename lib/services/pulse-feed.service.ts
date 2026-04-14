import { Redis } from '@upstash/redis'

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
  const r = getRedis()
  if (!r) {
    return getDefaultPulseMock()
  }
  try {
    const rows = await r.lrange<string>(LIST_KEY, 0, MAX - 1)
    if (!rows?.length) return getDefaultPulseMock()
    return rows.map((raw) => {
      try {
        return typeof raw === 'string' ? (JSON.parse(raw) as PulseEntry) : (raw as PulseEntry)
      } catch {
        return null
      }
    }).filter(Boolean) as PulseEntry[]
  } catch {
    return getDefaultPulseMock()
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
