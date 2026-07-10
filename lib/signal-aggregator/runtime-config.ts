/**
 * Server-side signal realtime URLs.
 * Prefer SIGNAL_REALTIME_URL (runtime env) over NEXT_PUBLIC_* (build-time).
 */

export function resolveSignalRealtimeHttpBase(): string {
  return (
    process.env.SIGNAL_REALTIME_URL?.trim() ||
    `http://127.0.0.1:${process.env.SIGNAL_REALTIME_PORT ?? 4102}`
  ).replace(/\/$/, '')
}

export function signalRealtimeIsExternal(): boolean {
  const base = process.env.SIGNAL_REALTIME_URL?.trim()
  if (!base) return false
  return !base.includes('127.0.0.1') && !base.includes('localhost')
}

/** Vercel-only deploys use Supabase history + client polling (no WebSocket server). */
export function signalFeedMode(): 'poll' | 'websocket' {
  if (process.env.SIGNAL_FEED_MODE === 'poll') return 'poll'
  if (process.env.SIGNAL_FEED_MODE === 'websocket') return 'websocket'
  return signalRealtimeIsExternal() ? 'websocket' : 'poll'
}

/** Derive ws(s) URL from SIGNAL_REALTIME_URL when NEXT_PUBLIC_SIGNAL_WS_URL is unset. */
export function resolveSignalWsUrl(): string {
  if (signalFeedMode() === 'poll') return ''

  const explicit = process.env.NEXT_PUBLIC_SIGNAL_WS_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const http = process.env.SIGNAL_REALTIME_URL?.trim()
  if (http && signalRealtimeIsExternal()) {
    return http
      .replace(/^https:/i, 'wss:')
      .replace(/^http:/i, 'ws:')
      .replace(/\/$/, '')
  }

  return ''
}
