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

/** Prefer live Redis heartbeat from telegram-monitor worker; else Supabase allowlist count. */
export async function buildDataSourceStatusLive(txoddsLive: boolean): Promise<DataSourceStatus> {
  const hb = await readTelegramMonitorHeartbeat()
  if (isHeartbeatFresh(hb)) {
    return {
      telegram: heartbeatToSourceStatus(hb),
      txodds: { live: txoddsLive },
      ingestionWorkerLive: true,
    }
  }

  const fromDb = await readTelegramChannelCountFromSupabase()
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
