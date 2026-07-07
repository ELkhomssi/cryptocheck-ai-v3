import { readFileSync } from 'node:fs'
import { isPublicChannelRef, normalizeChannelRef } from './config.js'

export function parseChannelsFile(path: string): string[] {
  const raw = readFileSync(path, 'utf8')
  const parsed = JSON.parse(raw) as { channels?: unknown }
  if (!Array.isArray(parsed.channels)) {
    throw new Error(`Invalid channels config at ${path}: expected { "channels": string[] }`)
  }
  const out: string[] = []
  for (const item of parsed.channels) {
    if (typeof item !== 'string') continue
    const ref = normalizeChannelRef(item)
    if (!isPublicChannelRef(ref)) {
      console.warn('[channel-registry] skipping non-public channel ref', { ref })
      continue
    }
    out.push(ref)
  }
  return [...new Set(out)]
}

async function fetchEnabledFromSupabase(): Promise<string[] | null> {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null

  try {
    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/telegram_channels?enabled=eq.true&select=username`
    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[channel-registry] Supabase fetch failed', { status: res.status })
      return null
    }
    const rows = (await res.json()) as { username?: string }[]
    const channels = rows
      .map((r) => (typeof r.username === 'string' ? normalizeChannelRef(r.username) : ''))
      .filter((ref) => ref && isPublicChannelRef(ref))
    return [...new Set(channels)]
  } catch (e) {
    console.warn('[channel-registry] Supabase fetch error', e instanceof Error ? e.message : e)
    return null
  }
}

/** Supabase allowlist first; fall back to channels.json when DB empty/unavailable. */
export async function resolveTelegramChannelList(channelsConfigPath: string): Promise<string[]> {
  const fromDb = await fetchEnabledFromSupabase()
  if (fromDb && fromDb.length > 0) {
    console.info('[channel-registry] loaded channels from Supabase', { count: fromDb.length })
    return fromDb
  }

  try {
    const fromFile = parseChannelsFile(channelsConfigPath)
    if (fromFile.length > 0) {
      console.info('[channel-registry] loaded channels from file', {
        count: fromFile.length,
        path: channelsConfigPath,
      })
    }
    return fromFile
  } catch (e) {
    console.warn('[channel-registry] file fallback failed', e instanceof Error ? e.message : e)
    return []
  }
}

export function startChannelRegistryRefresh(
  channelsConfigPath: string,
  onChannels: (channels: string[]) => void,
  intervalMs = 300_000,
): () => void {
  const tick = () => {
    void resolveTelegramChannelList(channelsConfigPath)
      .then(onChannels)
      .catch((e) => console.warn('[channel-registry] refresh failed', e instanceof Error ? e.message : e))
  }
  const timer = setInterval(tick, intervalMs)
  return () => clearInterval(timer)
}
