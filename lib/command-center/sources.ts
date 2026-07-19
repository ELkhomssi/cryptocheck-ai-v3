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
  telegram: { live: boolean; channelCount: number }
  txodds: { live: boolean }
  twitter: { live: boolean; handleCount: number }
  /** When true, a worker heartbeat proves ingestion is actively running. */
  ingestionWorkerLive?: boolean
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
    telegram: { live: channelCount > 0, channelCount },
    txodds: { live: txoddsLive },
    twitter: emptyTwitter(),
    ingestionWorkerLive: false,
  }
}

/**
 * Prefer live Redis heartbeat from telegram-monitor / twitter-monitor.
 */
export async function buildDataSourceStatusLive(txoddsLive: boolean): Promise<DataSourceStatus> {
  const hb = await readTelegramMonitorHeartbeat()
  const twHb = await readServiceHeartbeat('twitter-monitor')
  const fromDb = await readTelegramChannelCountFromSupabase()
  const twitterFromDb = await readTwitterHandleCountFromSupabase()

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

  if (isHeartbeatFresh(hb) && hb) {
    const fromHb = heartbeatToSourceStatus(hb)
    if (fromHb.channelCount > 0) {
      return {
        telegram: fromHb,
        txodds: { live: txoddsLive },
        twitter,
        ingestionWorkerLive: true,
      }
    }
    const channelCount = fromDb > 0 ? fromDb : readTelegramChannelCountFromConfig()
    return {
      telegram: {
        live: channelCount > 0 && hb.status !== 'down',
        channelCount,
      },
      txodds: { live: txoddsLive },
      twitter,
      ingestionWorkerLive: true,
    }
  }

  if (fromDb > 0) {
    return {
      telegram: { live: false, channelCount: fromDb },
      txodds: { live: txoddsLive },
      twitter,
      ingestionWorkerLive: isHeartbeatFresh(twHb),
    }
  }

  const fromFile = readTelegramChannelCountFromConfig()
  return {
    ...buildDataSourceStatus(txoddsLive, fromFile),
    twitter,
    ingestionWorkerLive: isHeartbeatFresh(twHb),
  }
}
