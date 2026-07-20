import 'server-only'

import { readFileSync } from 'fs'
import { join } from 'path'
import { isHeartbeatFresh } from '@cryptocheck/signal-contracts'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  heartbeatToSourceStatus,
  readServiceHeartbeat,
  readTelegramMonitorHeartbeat,
} from '@/lib/signal-aggregator/service-heartbeat'

export type DataSourceStatus = {
  telegram: {
    live: boolean
    channelCount: number
    /** ISO timestamp of newest telegram row in signal_normalized (null if none). */
    lastIngestAt?: string | null
    /** Sample public channel handles (for UI). */
    sampleChannels?: string[]
  }
  txodds: { live: boolean }
  twitter: { live: boolean; handleCount: number }
  /** When true, a worker heartbeat proves ingestion is actively running. */
  ingestionWorkerLive?: boolean
}

/** Newest telegram ingest + a few channel handles for the Data Sources chip. */
export async function readTelegramFeedMeta(): Promise<{
  lastIngestAt: string | null
  sampleChannels: string[]
}> {
  try {
    const sb = getSupabaseAdmin()
    const { data: latest } = await sb
      .from('signal_normalized')
      .select('ingest_timestamp')
      .eq('source_tag', 'telegram')
      .eq('dropped', false)
      .order('ingest_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastIngestAt =
      latest && typeof (latest as { ingest_timestamp?: string }).ingest_timestamp === 'string'
        ? (latest as { ingest_timestamp: string }).ingest_timestamp
        : null

    const { data: channelRows } = await sb
      .from('telegram_channels')
      .select('username')
      .eq('enabled', true)
      .eq('platform', 'telegram')
      .order('username', { ascending: true })
      .limit(5)

    let sampleChannels = (channelRows ?? [])
      .map((r) => (typeof r.username === 'string' ? r.username : ''))
      .filter(Boolean)
      .map((u) => (u.startsWith('@') ? u : `@${u}`))

    if (sampleChannels.length === 0) {
      const legacy = await sb
        .from('telegram_channels')
        .select('username')
        .eq('enabled', true)
        .order('username', { ascending: true })
        .limit(5)
      sampleChannels = (legacy.data ?? [])
        .map((r) => (typeof r.username === 'string' ? r.username : ''))
        .filter(Boolean)
        .map((u) => (u.startsWith('@') ? u : `@${u}`))
    }

    return { lastIngestAt, sampleChannels }
  } catch {
    return { lastIngestAt: null, sampleChannels: [] }
  }
}

/** Enabled public channels in Supabase (configured, not necessarily ingesting). */
export async function readTelegramChannelCountFromSupabase(): Promise<number> {
  try {
    const sb = getSupabaseAdmin()
    let q = sb
      .from('telegram_channels')
      .select('id', { count: 'exact', head: true })
      .eq('enabled', true)
      .eq('platform', 'telegram')
    let { count, error } = await q
    if (error) {
      const legacy = await sb
        .from('telegram_channels')
        .select('id', { count: 'exact', head: true })
        .eq('enabled', true)
      count = legacy.count
      error = legacy.error
    }
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function readTwitterHandleCountFromSupabase(): Promise<number> {
  try {
    const sb = getSupabaseAdmin()
    const { count, error } = await sb
      .from('telegram_channels')
      .select('id', { count: 'exact', head: true })
      .eq('enabled', true)
      .eq('platform', 'twitter')
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/** File/env fallback when pipeline heartbeat is stale or missing. */
export function readTelegramChannelCountFromConfig(): number {
  const env = process.env.SIGNAL_TELEGRAM_CHANNEL_COUNT?.trim()
  if (env) {
    const n = parseInt(env, 10)
    if (Number.isFinite(n) && n >= 0) return n
  }

  try {
    const cfgPath =
      process.env.SIGNAL_CHANNELS_CONFIG?.trim() ||
      join(process.cwd(), 'services/ingestion/config/channels.json')
    const raw = readFileSync(cfgPath, 'utf8')
    const cfg = JSON.parse(raw) as { channels?: unknown[] }
    return Array.isArray(cfg.channels) ? cfg.channels.length : 0
  } catch {
    return 0
  }
}

function emptyTwitter(): { live: boolean; handleCount: number } {
  return { live: false, handleCount: 0 }
}

export function buildDataSourceStatus(txoddsLive: boolean, channelCount: number): DataSourceStatus {
  return {
    telegram: { live: channelCount > 0, channelCount, lastIngestAt: null, sampleChannels: [] },
    txodds: { live: txoddsLive },
    twitter: emptyTwitter(),
    ingestionWorkerLive: false,
  }
}

/**
 * Prefer live Redis heartbeat from telegram-monitor / twitter-monitor.
 */
export async function buildDataSourceStatusLive(txoddsLive: boolean): Promise<DataSourceStatus> {
  const [hb, twHb, fromDb, twitterFromDb, feedMeta] = await Promise.all([
    readTelegramMonitorHeartbeat(),
    readServiceHeartbeat('twitter-monitor'),
    readTelegramChannelCountFromSupabase(),
    readTwitterHandleCountFromSupabase(),
    readTelegramFeedMeta(),
  ])

  const twitter = (() => {
    if (isHeartbeatFresh(twHb) && twHb) {
      const fromHb = heartbeatToSourceStatus(twHb)
      if (fromHb.channelCount > 0) {
        return { live: fromHb.live, handleCount: fromHb.channelCount }
      }
      const handleCount = twitterFromDb > 0 ? twitterFromDb : fromHb.channelCount
      return {
        live: handleCount > 0 && twHb.status !== 'down',
        handleCount,
      }
    }
    return { live: false, handleCount: twitterFromDb }
  })()

  const withMeta = (telegram: { live: boolean; channelCount: number }) => ({
    ...telegram,
    lastIngestAt: feedMeta.lastIngestAt,
    sampleChannels: feedMeta.sampleChannels,
  })

  if (isHeartbeatFresh(hb) && hb) {
    const fromHb = heartbeatToSourceStatus(hb)
    if (fromHb.channelCount > 0) {
      return {
        telegram: withMeta(fromHb),
        txodds: { live: txoddsLive },
        twitter,
        ingestionWorkerLive: true,
      }
    }
    const channelCount = fromDb > 0 ? fromDb : readTelegramChannelCountFromConfig()
    return {
      telegram: withMeta({
        live: channelCount > 0 && hb.status !== 'down',
        channelCount,
      }),
      txodds: { live: txoddsLive },
      twitter,
      ingestionWorkerLive: true,
    }
  }

  if (fromDb > 0) {
    return {
      telegram: withMeta({ live: false, channelCount: fromDb }),
      txodds: { live: txoddsLive },
      twitter,
      ingestionWorkerLive: isHeartbeatFresh(twHb),
    }
  }

  const fromFile = readTelegramChannelCountFromConfig()
  return {
    ...buildDataSourceStatus(txoddsLive, fromFile),
    telegram: withMeta({
      live: fromFile > 0,
      channelCount: fromFile,
    }),
    twitter,
    ingestionWorkerLive: isHeartbeatFresh(twHb),
  }
}
