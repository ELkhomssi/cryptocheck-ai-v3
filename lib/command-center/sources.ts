import 'server-only'

import { readFileSync } from 'fs'
import { join } from 'path'
import { isHeartbeatFresh } from '@cryptocheck/signal-contracts'
import {
  heartbeatToSourceStatus,
  readTelegramMonitorHeartbeat,
} from '@/lib/signal-aggregator/service-heartbeat'

export type DataSourceStatus = {
  telegram: { live: boolean; channelCount: number }
  txodds: { live: boolean }
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

export function buildDataSourceStatus(txoddsLive: boolean): DataSourceStatus {
  const channelCount = readTelegramChannelCountFromConfig()
  return {
    telegram: { live: channelCount > 0, channelCount },
    txodds: { live: txoddsLive },
  }
}

/** Prefer live Redis heartbeat from telegram-monitor on Railway. */
export async function buildDataSourceStatusLive(txoddsLive: boolean): Promise<DataSourceStatus> {
  const hb = await readTelegramMonitorHeartbeat()
  if (isHeartbeatFresh(hb)) {
    return {
      telegram: heartbeatToSourceStatus(hb),
      txodds: { live: txoddsLive },
    }
  }
  return buildDataSourceStatus(txoddsLive)
}
