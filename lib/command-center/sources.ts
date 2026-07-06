import 'server-only'

import { readFileSync } from 'fs'
import { join } from 'path'

export type DataSourceStatus = {
  telegram: { live: boolean; channelCount: number }
  txodds: { live: boolean }
}

/** Real Telegram channel count from ingestion config — never fabricated. */
export function readTelegramChannelCount(): number {
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
  const channelCount = readTelegramChannelCount()
  return {
    telegram: { live: channelCount > 0, channelCount },
    txodds: { live: txoddsLive },
  }
}
