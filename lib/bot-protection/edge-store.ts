/**
 * Edge-safe Upstash REST helpers for bot protection.
 * Avoids importing Node-only modules into middleware.
 */

const PREFIX = 'ccai:bot:'

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function upstashPipeline(commands: unknown[][]): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 80)
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      // ~budget: keep under a few ms on warm edge; fail open on timeout
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as Array<{ result?: unknown }>
    return json.map((row) => row?.result)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function incrRequestsLastMinute(ip: string): Promise<number | undefined> {
  if (!upstashConfigured() || !ip) return undefined
  const key = `${PREFIX}rpm:${ip}`
  const results = await upstashPipeline([
    ['INCR', key],
    ['EXPIRE', key, 60],
  ])
  const n = results?.[0]
  return typeof n === 'number' ? n : undefined
}

export async function isBlacklistedIp(ip: string): Promise<boolean> {
  if (!upstashConfigured() || !ip) return false
  const results = await upstashPipeline([['GET', `${PREFIX}bl:${ip}`]])
  return results?.[0] != null && results[0] !== ''
}

export async function logBlockedRequest(event: Record<string, unknown>): Promise<void> {
  if (!upstashConfigured()) return
  const key = `${PREFIX}log`
  const payload = JSON.stringify(event)
  // Keep a rolling list of recent blocks for the intelligence dashboard
  await upstashPipeline([
    ['LPUSH', key, payload],
    ['LTRIM', key, 0, 499],
    ['INCR', `${PREFIX}stats:blocked`],
    ['INCR', `${PREFIX}stats:score_bucket:${Math.min(9, Math.floor(Number(event.botScore ?? 0) / 10))}`],
  ])
}

export async function learnFingerprint(deviceKey: string, botScore: number): Promise<void> {
  if (!upstashConfigured() || !deviceKey) return
  // EMA-like running average for automatic learning
  const key = `${PREFIX}fp:${deviceKey}`
  const results = await upstashPipeline([['GET', key]])
  const prev = typeof results?.[0] === 'string' ? Number(results[0]) : NaN
  const next = Number.isFinite(prev) ? prev * 0.85 + botScore * 0.15 : botScore
  await upstashPipeline([['SET', key, String(Math.round(next)), 'EX', String(60 * 60 * 24 * 14)]])
}

export { PREFIX as BOT_REDIS_PREFIX }
