import { TWITTER_SOURCES } from '../scout.js'
import { resolveSupabaseAdminCreds } from '../lib/supabase-creds.js'

/** Normalize to bare lowercase handle (no @). */
export function normalizeTwitterHandle(ref: string): string {
  return ref.trim().replace(/^@/, '').toLowerCase()
}

function parseEnvHandles(): string[] {
  const raw = process.env.TWITTER_HANDLES?.trim() || ''
  if (!raw) return []
  return [...new Set(raw.split(',').map(normalizeTwitterHandle).filter(Boolean))]
}

async function fetchEnabledFromSupabase(): Promise<string[] | null> {
  const creds = resolveSupabaseAdminCreds()
  if (!creds) return null

  try {
    const headers = { apikey: creds.key, Authorization: `Bearer ${creds.key}` }
    const url = `${creds.url}/rest/v1/telegram_channels?enabled=eq.true&platform=eq.twitter&select=username`
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) {
      console.warn('[twitter-handles] Supabase fetch failed', { status: res.status })
      return null
    }
    const rows = (await res.json()) as { username?: string }[]
    return [
      ...new Set(
        rows
          .map((r) => (typeof r.username === 'string' ? normalizeTwitterHandle(r.username) : ''))
          .filter(Boolean),
      ),
    ]
  } catch (e) {
    console.warn('[twitter-handles] Supabase fetch error', e instanceof Error ? e.message : e)
    return null
  }
}

function curatedHandles(): string[] {
  return TWITTER_SOURCES.map((s) => normalizeTwitterHandle(s.handle)).filter(Boolean)
}

/**
 * Priority: TWITTER_HANDLES env → Supabase platform=twitter → curated scout list.
 * Public handles only — never private/paid scrapes.
 */
export async function resolveTwitterHandleList(): Promise<string[]> {
  const fromEnv = parseEnvHandles()
  if (fromEnv.length > 0) {
    console.info('[twitter-handles] loaded from TWITTER_HANDLES', { count: fromEnv.length })
    return fromEnv
  }

  const fromDb = await fetchEnabledFromSupabase()
  if (fromDb && fromDb.length > 0) {
    console.info('[twitter-handles] loaded from Supabase', { count: fromDb.length })
    return fromDb
  }

  const curated = curatedHandles()
  console.info('[twitter-handles] using curated fallback', { count: curated.length })
  return curated
}
