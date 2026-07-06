/**
 * App-side Signal Aggregator constants — UI routes, gateway injection, Redis namespaces.
 * Shared queue types live in @cryptocheck/signal-contracts.
 */

export {
  SIGNAL_STREAM_RAW,
  SIGNAL_STREAM_PARSED,
  SIGNAL_CONSUMER_GROUP_PARSER,
  SIGNAL_CONSUMER_GROUP_ENRICH,
  SIGNAL_PUBSUB_CHANNEL,
  SIGNAL_STREAM_FEED,
  SIGNAL_FEED_CACHE_KEY,
  SIGNAL_LATENCY_CONTRACT,
  SIGNAL_COMPLIANCE,
} from '@cryptocheck/signal-contracts'

/** Master Feed UI base path (Prompt 5). */
export const SIGNAL_FEED_BASE_PATH = '/dashboard/signals'

export const SIGNAL_NAV = {
  feed: SIGNAL_FEED_BASE_PATH,
  agent: `${SIGNAL_FEED_BASE_PATH}/agent`,
  settings: `${SIGNAL_FEED_BASE_PATH}/settings`,
} as const

export const SIGNAL_AMOUNT_PRESETS_USD = [25, 50, 100, 250] as const

export function signalWsUrl(): string {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SIGNAL_WS_URL) {
    return process.env.NEXT_PUBLIC_SIGNAL_WS_URL
  }
  if (process.env.NEXT_PUBLIC_SIGNAL_WS_URL) return process.env.NEXT_PUBLIC_SIGNAL_WS_URL
  return 'ws://localhost:4102'
}

/** Supabase table names (migration: supabase/migrations/*signal_aggregator*). */
export const SIGNAL_DB_TABLES = {
  normalized: 'signal_normalized',
  rawArchive: 'signal_raw_archive',
  subscriptions: 'signal_subscription',
} as const

/** Map gateway institutional verdict → feed chip (lowercase). */
export function gatewayVerdictToSentinel(
  verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED' | string,
): 'safe' | 'caution' | 'danger' {
  if (verdict === 'SAFE') return 'safe'
  if (verdict === 'CAUTION') return 'caution'
  return 'danger'
}

/** Deep-link into pre-filled swap sheet from a feed row (Prompt 5). */
export function signalSwapDeepLink(signalId: string, mint: string): string {
  const q = new URLSearchParams({ signalId, mint })
  return `${SIGNAL_FEED_BASE_PATH}?${q.toString()}`
}
