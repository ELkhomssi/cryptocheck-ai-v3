/**
 * Supabase client for signal_channel_metrics (ingestion side).
 */
import { normalizeChannelRef } from '../config.js'
import { resolveSupabaseAdminCreds } from '../lib/supabase-creds.js'
import {
  computeSuccessRate,
  computeTrustScore,
  dangerRate,
  METRICS_TRUST_LISTEN_FLOOR,
  shouldAutoDisable,
  type ChannelMetricsRow,
} from './metrics-formula.js'

function supabaseCreds(): { url: string; key: string } | null {
  return resolveSupabaseAdminCreds()
}

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

export type RankedChannel = {
  username: string
  trustScore: number
}

/** Enabled telegram channels ranked by trust_score (desc). Low-trust / auto-disabled omitted. */
export async function fetchChannelsRankedByTrust(): Promise<RankedChannel[] | null> {
  const creds = supabaseCreds()
  if (!creds) return null

  try {
    const h = headers(creds.key)
    const channelsUrl =
      `${creds.url}/rest/v1/telegram_channels?enabled=eq.true&platform=eq.telegram&select=username`
    const legacyUrl = `${creds.url}/rest/v1/telegram_channels?enabled=eq.true&select=username`
    let res = await fetch(channelsUrl, { headers: h, cache: 'no-store' })
    if (!res.ok) res = await fetch(legacyUrl, { headers: h, cache: 'no-store' })
    if (!res.ok) return null

    const channelRows = (await res.json()) as { username?: string }[]
    const usernames = [
      ...new Set(
        channelRows
          .map((r) => (typeof r.username === 'string' ? normalizeChannelRef(r.username) : ''))
          .filter(Boolean),
      ),
    ]
    if (usernames.length === 0) return []

    const metricsUrl =
      `${creds.url}/rest/v1/signal_channel_metrics?platform=eq.telegram&auto_disabled=eq.false&select=channel_id,trust_score`
    const mRes = await fetch(metricsUrl, { headers: h, cache: 'no-store' })
    const trust = new Map<string, number>()
    if (mRes.ok) {
      const rows = (await mRes.json()) as { channel_id?: string; trust_score?: number }[]
      for (const r of rows) {
        if (typeof r.channel_id !== 'string') continue
        trust.set(normalizeChannelRef(r.channel_id).toLowerCase(), Number(r.trust_score) || 50)
      }
    }

    const ranked: RankedChannel[] = usernames.map((u) => ({
      username: u,
      trustScore: trust.get(u.toLowerCase()) ?? 50,
    }))

    ranked.sort((a, b) => b.trustScore - a.trustScore || a.username.localeCompare(b.username))

    const floor = METRICS_TRUST_LISTEN_FLOOR
    // Always keep channels with no metrics yet (default 50) and those above floor.
    // Cap optional via env to protect GramJS join FloodWait.
    const maxListen = Number(process.env.SIGNAL_CHANNEL_MAX_LISTEN ?? 200)
    const filtered = ranked.filter((c) => c.trustScore >= floor || !trust.has(c.username.toLowerCase()))
    return filtered.slice(0, maxListen)
  } catch (e) {
    console.warn('[channel-metrics] ranked fetch failed', e instanceof Error ? e.message : e)
    return null
  }
}

/** Seed metrics row when scout enrolls a channel (idempotent). */
export async function upsertDiscoveryPrior(input: {
  channelId: string
  trustPrior: number
  audienceSize?: number
  engagementScore?: number
}): Promise<void> {
  const creds = supabaseCreds()
  if (!creds) return

  const channelId = normalizeChannelRef(input.channelId)
  const trust = Math.min(100, Math.max(0, input.trustPrior))
  const body = {
    platform: 'telegram',
    channel_id: channelId,
    trust_score: trust,
    audience_size: input.audienceSize ?? null,
    engagement_score: input.engagementScore ?? null,
    updated_at: new Date().toISOString(),
  }

  try {
    await fetch(
      `${creds.url}/rest/v1/signal_channel_metrics?on_conflict=platform,channel_id`,
      {
        method: 'POST',
        headers: {
          ...headers(creds.key),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(body),
      },
    )
  } catch (e) {
    console.warn('[channel-metrics] prior upsert failed', e instanceof Error ? e.message : e)
  }
}

export async function disableChannelInAllowlist(
  channelId: string,
  reason: string,
): Promise<void> {
  const creds = supabaseCreds()
  if (!creds) return
  const username = normalizeChannelRef(channelId)
  const h = {
    ...headers(creds.key),
    Prefer: 'return=minimal',
  }

  try {
    await fetch(
      `${creds.url}/rest/v1/telegram_channels?username=eq.${encodeURIComponent(username)}`,
      {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
      },
    )
    // Also try without @ prefix variants
    const bare = username.replace(/^@/, '')
    if (bare !== username) {
      await fetch(
        `${creds.url}/rest/v1/telegram_channels?username=eq.${encodeURIComponent(bare)}`,
        {
          method: 'PATCH',
          headers: h,
          body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
        },
      )
    }
    await fetch(
      `${creds.url}/rest/v1/signal_channel_metrics?platform=eq.telegram&channel_id=eq.${encodeURIComponent(username)}`,
      {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({
          auto_disabled: true,
          auto_disable_reason: reason,
          updated_at: new Date().toISOString(),
        }),
      },
    )
    console.info('[channel-metrics] auto-disabled channel', { username, reason })
  } catch (e) {
    console.warn('[channel-metrics] disable failed', e instanceof Error ? e.message : e)
  }
}

export function recomputeRow(partial: ChannelMetricsRow): ChannelMetricsRow {
  const success = computeSuccessRate(
    partial.signals_safe,
    partial.signals_caution,
    partial.signals_danger,
  )
  const dRate = dangerRate(partial.signals_safe, partial.signals_caution, partial.signals_danger)
  const trust = computeTrustScore({
    successRate: success,
    dangerRate: dRate,
    latencyMs: partial.latency_ms,
    engagementScore: partial.engagement_score,
  })
  return {
    ...partial,
    success_rate: success,
    trust_score: trust,
  }
}

export { shouldAutoDisable }
