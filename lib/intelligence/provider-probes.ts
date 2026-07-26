/**
 * Phase 16.2 — provider uptime + last-successful-call tracking for Intelligence Scores.
 * Redis keys: ccai:intel:provider:*
 */

import { Redis } from '@upstash/redis'

export type IntelProviderId = 'jupiter' | 'birdeye' | 'helius' | 'news'

type ProbeEntry = { ts: number; ok: boolean; latencyMs: number | null }

const PROBES_KEY = (id: string) => `ccai:intel:provider:probes:${id}`
const LAST_OK_KEY = (id: string) => `ccai:intel:provider:last_ok:${id}`
const MAX_PROBES = 2_000

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

export async function recordProviderProbe(
  providerId: IntelProviderId,
  ok: boolean,
  latencyMs: number | null,
): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    const entry = JSON.stringify({ ts: Date.now(), ok, latencyMs } satisfies ProbeEntry)
    await r.lpush(PROBES_KEY(providerId), entry)
    await r.ltrim(PROBES_KEY(providerId), 0, MAX_PROBES - 1)
    if (ok) {
      await r.set(LAST_OK_KEY(providerId), String(Date.now()))
    }
  } catch {
    /* best-effort */
  }
}

export async function getProviderLastOkMs(providerId: IntelProviderId): Promise<number | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const raw = await r.get<string>(LAST_OK_KEY(providerId))
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export type ProviderUptimeResult = {
  uptimePct: number | null
  probesInWindow: number
  okProbes: number
  oldestProbeAgeMs: number | null
}

/** Rolling uptime over the last `windowMs` (default 24h). */
export async function getProviderUptimePct(
  providerId: IntelProviderId,
  windowMs = 24 * 60 * 60 * 1000,
): Promise<ProviderUptimeResult> {
  const r = getRedis()
  if (!r) {
    return { uptimePct: null, probesInWindow: 0, okProbes: 0, oldestProbeAgeMs: null }
  }
  try {
    const items = await r.lrange(PROBES_KEY(providerId), 0, MAX_PROBES - 1)
    const cutoff = Date.now() - windowMs
    let ok = 0
    let total = 0
    let oldestTs: number | null = null
    for (const raw of items) {
      try {
        const o =
          typeof raw === 'string'
            ? (JSON.parse(raw) as ProbeEntry)
            : (raw as ProbeEntry)
        if (typeof o.ts !== 'number' || o.ts < cutoff) continue
        total++
        if (o.ok === true) ok++
        if (oldestTs == null || o.ts < oldestTs) oldestTs = o.ts
      } catch {
        continue
      }
    }
    if (total === 0) {
      return { uptimePct: null, probesInWindow: 0, okProbes: 0, oldestProbeAgeMs: null }
    }
    return {
      uptimePct: Math.round((ok / total) * 10_000) / 100,
      probesInWindow: total,
      okProbes: ok,
      oldestProbeAgeMs: oldestTs != null ? Date.now() - oldestTs : null,
    }
  } catch {
    return { uptimePct: null, probesInWindow: 0, okProbes: 0, oldestProbeAgeMs: null }
  }
}

/**
 * Map roster AgentDataSource → probeable provider ids.
 */
export function providersForDataSources(
  sources: string[],
): IntelProviderId[] {
  const out = new Set<IntelProviderId>()
  for (const s of sources) {
    if (s.startsWith('jupiter')) out.add('jupiter')
    else if (s.startsWith('birdeye') || s === 'raydium-pools') out.add('birdeye')
    else if (s.startsWith('helius')) out.add('helius')
    else if (s === 'news-sentiment') out.add('news')
    else if (s === 'portfolio-analytics' || s === 'portfolio-alerts') {
      out.add('helius')
      out.add('jupiter')
    }
  }
  return [...out]
}
