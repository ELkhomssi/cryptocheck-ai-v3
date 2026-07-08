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

/** Derive ws(s) URL from SIGNAL_REALTIME_URL when NEXT_PUBLIC_SIGNAL_WS_URL is unset. */
export function resolveSignalWsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SIGNAL_WS_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const http = process.env.SIGNAL_REALTIME_URL?.trim()
  if (http) {
    return http
      .replace(/^https:/i, 'wss:')
      .replace(/^http:/i, 'ws:')
      .replace(/\/$/, '')
  }

  return 'ws://localhost:4102'
}
