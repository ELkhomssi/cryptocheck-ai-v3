import 'server-only'

import { Redis } from '@upstash/redis'

const LIST_KEY = 'status:uptime:probes:v1'
const MAX_LEN = 30_000

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

/** Called from the uptime cron after probing our own `/api/health`. */
export async function recordUptimeProbe(ok: boolean): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    const entry = JSON.stringify({ ts: Date.now(), ok })
    await r.lpush(LIST_KEY, entry)
    await r.ltrim(LIST_KEY, 0, MAX_LEN - 1)
  } catch {
    /* best-effort */
  }
}

export type RollingUptimeResult = {
  availability_pct: number | null
  probes_in_window: number
  ok_probes: number
}

export async function getRollingAvailabilityPct(windowDays: number): Promise<RollingUptimeResult> {
  const r = getRedis()
  if (!r) return { availability_pct: null, probes_in_window: 0, ok_probes: 0 }
  try {
    const items = await r.lrange(LIST_KEY, 0, MAX_LEN - 1)
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
    let ok = 0
    let total = 0
    for (const raw of items) {
      try {
        const o = typeof raw === 'string' ? (JSON.parse(raw) as { ts?: number; ok?: boolean }) : (raw as { ts?: number; ok?: boolean })
        if (typeof o.ts !== 'number' || o.ts < cutoff) continue
        total++
        if (o.ok === true) ok++
      } catch {
        continue
      }
    }
    if (total === 0) return { availability_pct: null, probes_in_window: 0, ok_probes: 0 }
    return {
      availability_pct: Math.round((ok / total) * 10_000) / 100,
      probes_in_window: total,
      ok_probes: ok,
    }
  } catch {
    return { availability_pct: null, probes_in_window: 0, ok_probes: 0 }
  }
}
