/**
 * Terminal OS resilience layer — circuit breaker + last-known-good + Demo Mode.
 * Demo rule: never surface blank/error panels; serve LKG or labeled demo dataset.
 */

import 'server-only'

import { cacheGetJson, cacheSetJson } from '@/lib/cache/ttl'

export type CircuitState = 'closed' | 'open' | 'half'

export type FeedEnvelope<T> = {
  data: T
  source: string
  fetchedAt: string
  stale: boolean
  ageSec: number
  demo: boolean
  circuit: CircuitState
}

type Breaker = {
  failures: number
  openedAt: number
  state: CircuitState
}

const breakers = new Map<string, Breaker>()
const FAIL_THRESHOLD = 3
const OPEN_MS = 45_000

function getBreaker(provider: string): Breaker {
  let b = breakers.get(provider)
  if (!b) {
    b = { failures: 0, openedAt: 0, state: 'closed' }
    breakers.set(provider, b)
  }
  if (b.state === 'open' && Date.now() - b.openedAt > OPEN_MS) {
    b.state = 'half'
  }
  return b
}

function recordSuccess(provider: string) {
  breakers.set(provider, { failures: 0, openedAt: 0, state: 'closed' })
}

function recordFailure(provider: string) {
  const b = getBreaker(provider)
  b.failures += 1
  if (b.failures >= FAIL_THRESHOLD) {
    b.state = 'open'
    b.openedAt = Date.now()
  }
}

/** Explicit demo insurance — venue wifi / total provider outage */
export function isDemoModeForced(): boolean {
  const v = (process.env.TERMINAL_OS_DEMO_MODE || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function lkgKey(key: string) {
  return `tos:lkg:${key}`
}

function freshKey(key: string) {
  return `tos:fresh:${key}`
}

/**
 * Fetch with TTL cache, long-lived LKG, circuit breaker, and demo fallback.
 * Always returns data — never throws for empty upstream.
 */
export async function resilientProvider<T>(opts: {
  key: string
  ttlSec: number
  /** How long to keep last-known-good (default 30 min) */
  lkgTtlSec?: number
  provider: string
  fetchLive: () => Promise<T>
  isEmpty?: (v: T) => boolean
  demoFallback: () => T
}): Promise<FeedEnvelope<T>> {
  const lkgTtl = opts.lkgTtlSec ?? 1_800
  const empty = opts.isEmpty ?? ((v: T) => v == null || (Array.isArray(v) && v.length === 0))
  const now = Date.now()

  if (isDemoModeForced()) {
    const data = opts.demoFallback()
    return {
      data,
      source: `${opts.provider}+demo-mode`,
      fetchedAt: new Date().toISOString(),
      stale: true,
      ageSec: 0,
      demo: true,
      circuit: 'open',
    }
  }

  const breaker = getBreaker(opts.provider)

  // Fresh cache hit
  const fresh = await cacheGetJson<{ value: T; at: number }>(freshKey(opts.key))
  if (fresh && !empty(fresh.value) && now - fresh.at < opts.ttlSec * 1000) {
    return {
      data: fresh.value,
      source: opts.provider,
      fetchedAt: new Date(fresh.at).toISOString(),
      stale: false,
      ageSec: Math.floor((now - fresh.at) / 1000),
      demo: false,
      circuit: breaker.state,
    }
  }

  // Circuit open → LKG or demo, skip upstream
  if (breaker.state === 'open') {
    const lkg = await cacheGetJson<{ value: T; at: number }>(lkgKey(opts.key))
    if (lkg && !empty(lkg.value)) {
      return {
        data: lkg.value,
        source: `${opts.provider}+lkg`,
        fetchedAt: new Date(lkg.at).toISOString(),
        stale: true,
        ageSec: Math.floor((now - lkg.at) / 1000),
        demo: false,
        circuit: 'open',
      }
    }
    const data = opts.demoFallback()
    return {
      data,
      source: `${opts.provider}+demo-fallback`,
      fetchedAt: new Date().toISOString(),
      stale: true,
      ageSec: 0,
      demo: true,
      circuit: 'open',
    }
  }

  try {
    const value = await opts.fetchLive()
    if (empty(value)) throw new Error('empty upstream')
    recordSuccess(opts.provider)
    const at = Date.now()
    await cacheSetJson(freshKey(opts.key), { value, at }, opts.ttlSec)
    await cacheSetJson(lkgKey(opts.key), { value, at }, lkgTtl)
    return {
      data: value,
      source: opts.provider,
      fetchedAt: new Date(at).toISOString(),
      stale: false,
      ageSec: 0,
      demo: false,
      circuit: 'closed',
    }
  } catch {
    recordFailure(opts.provider)
    const lkg = await cacheGetJson<{ value: T; at: number }>(lkgKey(opts.key))
    if (lkg && !empty(lkg.value)) {
      return {
        data: lkg.value,
        source: `${opts.provider}+lkg`,
        fetchedAt: new Date(lkg.at).toISOString(),
        stale: true,
        ageSec: Math.floor((Date.now() - lkg.at) / 1000),
        demo: false,
        circuit: getBreaker(opts.provider).state,
      }
    }
    const data = opts.demoFallback()
    return {
      data,
      source: `${opts.provider}+demo-fallback`,
      fetchedAt: new Date().toISOString(),
      stale: true,
      ageSec: 0,
      demo: true,
      circuit: getBreaker(opts.provider).state,
    }
  }
}

/** Pre-warm helper — fire-and-forget on stream/feed start */
export async function warmProviders(
  jobs: Array<() => Promise<unknown>>,
): Promise<void> {
  await Promise.allSettled(jobs.map((j) => j()))
}
