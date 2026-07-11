import 'server-only'

import { readFileSync } from 'fs'
import { join } from 'path'
import { isHeartbeatFresh } from '@cryptocheck/signal-contracts'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  heartbeatToSourceStatus,
  readTelegramMonitorHeartbeat,
} from '@/lib/signal-aggregator/service-heartbeat'

export type DataSourceStatus = {
  telegram: { live: boolean; channelCount: number }
  txodds: { live: boolean }
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

export function buildDataSourceStatus(txoddsLive: boolean, channelCount: number): DataSourceStatus {
  return {
    telegram: { live: channelCount > 0, channelCount },
    txodds: { live: txoddsLive },
    ingestionWorkerLive: false,
  }
}

/**
 * Prefer live Redis heartbeat from telegram-monitor.
 * If heartbeat is fresh but channels=0 (known sync bug), fall back to Supabase allowlist
 * so the chip does not show "0 Channels" while the worker is up.
 */
export async function buildDataSourceStatusLive(txoddsLive: boolean): Promise<DataSourceStatus> {
  const hb = await readTelegramMonitorHeartbeat()
  const fromDb = await readTelegramChannelCountFromSupabase()

  if (isHeartbeatFresh(hb) && hb) {
    const fromHb = heartbeatToSourceStatus(hb)
    if (fromHb.channelCount > 0) {
      return {
        telegram: fromHb,
        txodds: { live: txoddsLive },
        ingestionWorkerLive: true,
      }
    }
    // Worker alive but heartbeat under-reports joins — use allowlist count.
    const channelCount = fromDb > 0 ? fromDb : readTelegramChannelCountFromConfig()
    return {
      telegram: {
        live: channelCount > 0 && hb.status !== 'down',
        channelCount,
      },
      txodds: { live: txoddsLive },
      ingestionWorkerLive: true,
    }
  }

  if (fromDb > 0) {
    return {
      telegram: { live: false, channelCount: fromDb },
      txodds: { live: txoddsLive },
      ingestionWorkerLive: false,
    }
  }

  const fromFile = readTelegramChannelCountFromConfig()
  return buildDataSourceStatus(txoddsLive, fromFile)
}
