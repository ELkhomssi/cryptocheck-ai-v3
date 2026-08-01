import 'server-only'

import { Redis } from '@upstash/redis'
import { BOT_REDIS_PREFIX } from '@/lib/bot-protection/edge-store'
import type { BotLogEvent } from '@/lib/bot-protection/types'

export type BotIntelligenceSnapshot = {
  blockedTotal: number
  requestsSample: BotLogEvent[]
  topIps: { ip: string; count: number }[]
  topAsns: { asn: string; count: number }[]
  topCountries: { country: string; count: number }[]
  scoreDistribution: { bucket: string; count: number }[]
  generatedAt: string
  sample: boolean
}

function emptySnapshot(sample: boolean): BotIntelligenceSnapshot {
  return {
    blockedTotal: 0,
    requestsSample: [],
    topIps: [],
    topAsns: [],
    topCountries: [],
    scoreDistribution: [],
    generatedAt: new Date().toISOString(),
    sample,
  }
}

function rank(map: Map<string, number>, limit = 10): { key: string; count: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

export async function getBotIntelligenceSnapshot(): Promise<BotIntelligenceSnapshot> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return emptySnapshot(true)
  }

  try {
    const redis = Redis.fromEnv()
    const prefix = BOT_REDIS_PREFIX
    const [blockedRaw, logs] = await Promise.all([
      redis.get<number | string>(`${prefix}stats:blocked`),
      redis.lrange<string>(`${prefix}log`, 0, 199),
    ])

    const blockedTotal = Number(blockedRaw ?? 0) || 0
    const events: BotLogEvent[] = []
    for (const row of logs ?? []) {
      try {
        const parsed = typeof row === 'string' ? JSON.parse(row) : row
        if (parsed && typeof parsed === 'object') events.push(parsed as BotLogEvent)
      } catch {
        /* skip */
      }
    }

    const ips = new Map<string, number>()
    const asns = new Map<string, number>()
    const countries = new Map<string, number>()
    const scores = new Map<string, number>()

    for (const e of events) {
      if (e.ip) ips.set(e.ip, (ips.get(e.ip) ?? 0) + 1)
      if (e.asn) asns.set(e.asn, (asns.get(e.asn) ?? 0) + 1)
      if (e.country) countries.set(e.country, (countries.get(e.country) ?? 0) + 1)
      const bucket = `${Math.floor((e.botScore ?? 0) / 10) * 10}-${Math.floor((e.botScore ?? 0) / 10) * 10 + 9}`
      scores.set(bucket, (scores.get(bucket) ?? 0) + 1)
    }

    return {
      blockedTotal,
      requestsSample: events.slice(0, 50),
      topIps: rank(ips).map((r) => ({ ip: r.key, count: r.count })),
      topAsns: rank(asns).map((r) => ({ asn: r.key, count: r.count })),
      topCountries: rank(countries).map((r) => ({ country: r.key, count: r.count })),
      scoreDistribution: rank(scores, 10).map((r) => ({ bucket: r.key, count: r.count })),
      generatedAt: new Date().toISOString(),
      sample: events.length === 0,
    }
  } catch (err) {
    console.error('[bot-intelligence]', err)
    return emptySnapshot(true)
  }
}
