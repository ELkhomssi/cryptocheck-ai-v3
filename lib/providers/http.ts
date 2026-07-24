import 'server-only'

/**
 * Shared outbound fetch for external providers.
 * Acquires quota, respects Retry-After / 429 by pausing the provider,
 * and never throws fabricated payloads — callers get null on deny/failure.
 */

import {
  acquireProviderQuota,
  pauseProvider,
  type ProviderId,
} from '@/lib/providers/quota'

const DEFAULT_TIMEOUT_MS = 8_000

function parseRetryAfterMs(res: Response): number | undefined {
  const ra = res.headers.get('retry-after')
  if (!ra) return undefined
  const asInt = Number(ra)
  if (Number.isFinite(asInt) && asInt >= 0) return asInt * 1000
  const when = Date.parse(ra)
  if (Number.isFinite(when)) return Math.max(0, when - Date.now())
  return undefined
}

export type ProviderFetchResult =
  | { ok: true; res: Response }
  | { ok: false; reason: 'quota' | 'network' | 'http'; status?: number }

/**
 * Quota-gated fetch. On hard quota deny returns `{ ok:false, reason:'quota' }`
 * without hitting the network. On HTTP 429, pauses the provider.
 */
export async function providerFetch(
  provider: ProviderId,
  url: string,
  init?: RequestInit & { timeoutMs?: number; cost?: number },
): Promise<ProviderFetchResult> {
  const decision = await acquireProviderQuota(provider, init?.cost ?? 1)
  if (!decision.ok) {
    return { ok: false, reason: 'quota' }
  }

  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const { timeoutMs: _t, cost: _c, signal: userSignal, ...rest } = init ?? {}
    // Prefer our timeout signal; abort if caller also aborts
    if (userSignal) {
      if (userSignal.aborted) controller.abort()
      else userSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    const res = await fetch(url, { ...rest, signal: controller.signal, cache: rest.cache ?? 'no-store' })
    if (res.status === 429 || res.status === 503) {
      await pauseProvider(provider, parseRetryAfterMs(res))
      return { ok: false, reason: 'http', status: res.status }
    }
    if (!res.ok) return { ok: false, reason: 'http', status: res.status }
    return { ok: true, res }
  } catch {
    return { ok: false, reason: 'network' }
  } finally {
    clearTimeout(timer)
  }
}

/** JSON helper — returns null on quota/network/non-OK. */
export async function providerFetchJson<T = unknown>(
  provider: ProviderId,
  url: string,
  init?: RequestInit & { timeoutMs?: number; cost?: number },
): Promise<T | null> {
  const result = await providerFetch(provider, url, init)
  if (!result.ok) return null
  try {
    return (await result.res.json()) as T
  } catch {
    return null
  }
}
