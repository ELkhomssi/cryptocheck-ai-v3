import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SourceTag } from '@cryptocheck/signal-contracts'

export type TelegramShardConfig = {
  apiId: number
  apiHash: string
  sessionString: string
  channels: string[]
  sessionIndex: number
  sessionCount: number
  channelsConfigPath: string
}

export type TxOddsStreamMode = 'scores' | 'odds' | 'both'

export type TxOddsIngestionConfig = {
  apiOrigin: string
  jwt: string
  apiToken: string
  streamMode: TxOddsStreamMode
  fixtureIds: number[]
  fixtureRefreshMs: number
  reconnectBaseMs: number
  reconnectMaxMs: number
}

export type TwitterIngestionConfig = {
  bearerToken: string
  /** Empty → resolve from TWITTER_HANDLES / Supabase / curated list at start. */
  handles: string[]
  pollIntervalMs: number
  maxResults: number
}

export type LaunchpadIngestionConfig = {
  heliusApiKey: string
  pollMs: number
  minLiquidityUsd: number
  minAgeSec: number
  enabled: boolean
}

export type IngestionConfig = {
  sources: SourceTag[]
  telegram: TelegramShardConfig | null
  txodds: TxOddsIngestionConfig | null
  twitter: TwitterIngestionConfig | null
  launchpad: LaunchpadIngestionConfig | null
  healthPort: number
  streamMaxLen: number
  unifiedStreamMaxLen: number
}

const INVITE_PATTERNS = [
  /^\+/,
  /joinchat/i,
  /t\.me\/\+/i,
  /telegram\.me\/\+/i,
]

/** Public channels only — reject invite / private links. */
export function isPublicChannelRef(ref: string): boolean {
  const t = ref.trim()
  if (!t) return false
  return !INVITE_PATTERNS.some((p) => p.test(t))
}

export function normalizeChannelRef(ref: string): string {
  const t = ref.trim()
  if (t.startsWith('@')) return t
  if (/^\d+$/.test(t)) return t
  return `@${t.replace(/^@/, '')}`
}

function parseChannelsFile(path: string): string[] {
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
      console.warn('[signal-ingestion] skipping non-public channel ref', { ref })
      continue
    }
    out.push(ref)
  }
  return [...new Set(out)]
}

export function shardChannels(channels: string[], sessionIndex: number, sessionCount: number): string[] {
  if (sessionCount < 1) throw new Error('SIGNAL_SESSION_COUNT must be >= 1')
  if (sessionIndex < 0 || sessionIndex >= sessionCount) {
    throw new Error(`SIGNAL_SESSION_INDEX must be 0..${sessionCount - 1}`)
  }
  return channels.filter((_, i) => i % sessionCount === sessionIndex)
}

function parseSources(): SourceTag[] {
  const raw = process.env.SIGNAL_SOURCES?.trim() || 'telegram'
  const tags = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const out: SourceTag[] = []
  for (const tag of tags) {
    if (tag === 'telegram' || tag === 'txodds' || tag === 'twitter' || tag === 'launchpad') {
      if (!out.includes(tag)) out.push(tag)
      continue
    }
    throw new Error(`Unknown SIGNAL_SOURCES entry: ${tag} (use telegram, txodds, twitter, launchpad)`)
  }

  // TWITTER_ENABLED=true auto-adds twitter (bearer still required at load).
  if (process.env.TWITTER_ENABLED?.trim().toLowerCase() === 'true' && !out.includes('twitter')) {
    out.push('twitter')
  }
  if (process.env.TWITTER_ENABLED?.trim().toLowerCase() === 'false') {
    const filtered = out.filter((t) => t !== 'twitter')
    out.length = 0
    out.push(...filtered)
  }

  if (process.env.LAUNCHPAD_SCOUT_ENABLED?.trim().toLowerCase() === 'true' && !out.includes('launchpad')) {
    out.push('launchpad')
  }

  // Convenience kill-switch (deploy/.env.signal) — preferred over editing SIGNAL_SOURCES mid-debug.
  if (process.env.TXODDS_ENABLED?.trim().toLowerCase() === 'false') {
    const filtered = out.filter((t) => t !== 'txodds')
    if (filtered.length === 0) {
      throw new Error('TXODDS_ENABLED=false left SIGNAL_SOURCES empty — keep telegram enabled')
    }
    return filtered
  }
  if (out.length === 0) throw new Error('SIGNAL_SOURCES must include at least one source')
  return out
}

function loadTelegramConfig(): TelegramShardConfig {
  const apiId = Number(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH?.trim() ?? ''
  const sessionString =
    process.env.TELEGRAM_SESSION_STRING?.trim() ||
    process.env.TELEGRAM_SESSION?.trim() ||
    ''
  if (!Number.isFinite(apiId) || apiId <= 0) throw new Error('TELEGRAM_API_ID is required when telegram is enabled')
  if (!apiHash) throw new Error('TELEGRAM_API_HASH is required when telegram is enabled')
  if (!sessionString) throw new Error('TELEGRAM_SESSION_STRING is required when telegram is enabled')

  const channelsConfigPath = resolve(
    process.cwd(),
    process.env.SIGNAL_CHANNELS_CONFIG?.trim() || 'config/channels.json',
  )
  const sessionIndex = Number(process.env.SIGNAL_SESSION_INDEX ?? 0)
  const sessionCount = Number(process.env.SIGNAL_SESSION_COUNT ?? 1)

  return {
    apiId,
    apiHash,
    sessionString,
    channels: [],
    sessionIndex,
    sessionCount,
    channelsConfigPath,
  }
}

function parseFixtureIds(): number[] {
  const raw = process.env.TXLINE_FIXTURE_IDS?.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function loadTxOddsConfig(): TxOddsIngestionConfig {
  const apiOrigin = (process.env.TXLINE_API_ORIGIN?.trim() || 'https://txline.txodds.com').replace(
    /\/$/,
    '',
  )
  const jwt = process.env.TXLINE_JWT?.trim() ?? ''
  const apiToken = process.env.TXLINE_API_TOKEN?.trim() ?? ''
  if (!apiToken) {
    throw new Error('TXLINE_API_TOKEN is required when txodds is enabled')
  }

  const modeRaw = (process.env.TXLINE_STREAM_MODE?.trim() || 'both').toLowerCase()
  if (modeRaw !== 'scores' && modeRaw !== 'odds' && modeRaw !== 'both') {
    throw new Error('TXLINE_STREAM_MODE must be scores, odds, or both')
  }

  return {
    apiOrigin,
    jwt,
    apiToken,
    streamMode: modeRaw,
    fixtureIds: parseFixtureIds(),
    fixtureRefreshMs: Number(process.env.TXLINE_FIXTURE_REFRESH_MS ?? 3_600_000),
    reconnectBaseMs: Number(process.env.TXLINE_RECONNECT_BASE_MS ?? 2_000),
    reconnectMaxMs: Number(process.env.TXLINE_RECONNECT_MAX_MS ?? 60_000),
  }
}

function parseTwitterHandles(): string[] {
  const raw = process.env.TWITTER_HANDLES?.trim() || ''
  if (!raw) return []
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim().replace(/^@/, '').toLowerCase())
        .filter(Boolean),
    ),
  ]
}

function loadTwitterConfig(): TwitterIngestionConfig {
  const bearerToken =
    process.env.TWITTER_BEARER_TOKEN?.trim() ||
    process.env.X_BEARER_TOKEN?.trim() ||
    ''
  if (!bearerToken) {
    throw new Error('TWITTER_BEARER_TOKEN is required when twitter is enabled')
  }

  return {
    bearerToken,
    handles: parseTwitterHandles(),
    pollIntervalMs: Math.max(15_000, Number(process.env.TWITTER_POLL_MS ?? 60_000) || 60_000),
    maxResults: Math.min(100, Math.max(10, Number(process.env.TWITTER_MAX_RESULTS ?? 25) || 25)),
  }
}

function loadLaunchpadConfig(): LaunchpadIngestionConfig {
  const heliusApiKey =
    process.env.HELIUS_API_KEY?.trim() ||
    process.env.LAUNCHPAD_HELIUS_API_KEY?.trim() ||
    ''
  if (!heliusApiKey) {
    throw new Error('HELIUS_API_KEY is required when launchpad scout is enabled')
  }
  return {
    heliusApiKey,
    pollMs: Math.max(0, Number(process.env.LAUNCHPAD_POLL_MS ?? 0) || 0),
    minLiquidityUsd: Number(process.env.LAUNCHPAD_MIN_LIQUIDITY_USD ?? 500) || 500,
    minAgeSec: Number(process.env.LAUNCHPAD_MIN_AGE_SEC ?? 0) || 0,
    enabled: process.env.LAUNCHPAD_SCOUT_ENABLED?.trim().toLowerCase() !== 'false',
  }
}

export function loadConfig(): IngestionConfig {
  const sources = parseSources()

  return {
    sources,
    telegram: sources.includes('telegram') ? loadTelegramConfig() : null,
    txodds: sources.includes('txodds') ? loadTxOddsConfig() : null,
    twitter: sources.includes('twitter') ? loadTwitterConfig() : null,
    launchpad: sources.includes('launchpad') ? loadLaunchpadConfig() : null,
    healthPort: Number(process.env.SIGNAL_INGESTION_HEALTH_PORT ?? 4101),
    streamMaxLen: Number(process.env.SIGNAL_STREAM_RAW_MAXLEN ?? 100_000),
    unifiedStreamMaxLen: Number(process.env.SIGNAL_STREAM_UNIFIED_MAXLEN ?? 100_000),
  }
}
