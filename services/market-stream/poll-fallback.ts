/**
 * 5s polling fallback when WebSocket URL not configured (serverless-safe).
 */
export function createPollFallback(
  path: string,
  opts: {
    intervalMs?: number
    onMessage: (data: unknown) => void
    /** Called when `fetch` succeeds but HTTP status is not 2xx (e.g. 401). */
    onPollError?: (status: number) => void
  }
): { stop: () => void } {
  const ms = opts.intervalMs ?? 5000
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const res = await fetch(path, { credentials: 'include' })
      if (res.ok) {
        opts.onMessage(await res.json())
      } else {
        opts.onPollError?.(res.status)
      }
    } catch {
      /* swallow — caller may log */
    }
  }
  const id = setInterval(() => void tick(), ms)
  void tick()
  return {
    stop: () => {
      stopped = true
      clearInterval(id)
    },
  }
}
