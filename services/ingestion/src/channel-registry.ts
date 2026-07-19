import { readFileSync } from 'node:fs'
import { isPublicChannelRef, normalizeChannelRef } from './config.js'
import { fetchChannelsRankedByTrust } from './discovery/channel-metrics.js'
import { resolveSupabaseAdminCreds } from './lib/supabase-creds.js'

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
  // Prefer trust-ranked list (signal_channel_metrics). Falls back if table missing.
  const ranked = await fetchChannelsRankedByTrust()
  if (ranked && ranked.length > 0) {
    console.info('[channel-registry] loaded channels ranked by trust_score', {
      count: ranked.length,
      top: ranked.slice(0, 5).map((c) => ({ u: c.username, trust: c.trustScore })),
    })
    return ranked.map((c) => c.username)
  }

  const creds = resolveSupabaseAdminCreds()
  if (!creds) return null

  try {
    const headers = { apikey: creds.key, Authorization: `Bearer ${creds.key}` }
    const root = creds.url
    const scoped = `${root}/rest/v1/telegram_channels?enabled=eq.true&platform=eq.telegram&select=username`
    const legacy = `${root}/rest/v1/telegram_channels?enabled=eq.true&select=username`
    let res = await fetch(scoped, { headers, cache: 'no-store' })
    if (!res.ok) {
      res = await fetch(legacy, { headers, cache: 'no-store' })
    }
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

/**
 * Merge pin file + Supabase allowlist.
 * `channels.json` pins (e.g. @SOLTRENDING) always lead — DB trust ranking alone
 * was omitting call channels that matter for Alpha.
 */
export async function resolveTelegramChannelList(channelsConfigPath: string): Promise<string[]> {
  let fromFile: string[] = []
  try {
    fromFile = parseChannelsFile(channelsConfigPath)
  } catch (e) {
    console.warn('[channel-registry] file read failed', e instanceof Error ? e.message : e)
  }

  const fromDb = await fetchEnabledFromSupabase()
  if (fromDb && fromDb.length > 0) {
    const seen = new Set<string>()
    const merged: string[] = []
    for (const ref of [...fromFile, ...fromDb]) {
      const key = ref.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(ref)
    }
    console.info('[channel-registry] loaded channels (pins + Supabase)', {
      pins: fromFile.length,
      db: fromDb.length,
      merged: merged.length,
      pinSample: fromFile.slice(0, 5),
    })
    return merged
  }

  if (fromFile.length > 0) {
    console.info('[channel-registry] loaded channels from file', {
      count: fromFile.length,
      path: channelsConfigPath,
    })
  }
  return fromFile
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
