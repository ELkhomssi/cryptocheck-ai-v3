/**
 * 5s polling fallback when WebSocket URL not configured (serverless-safe).
 */
export function createPollFallback(
  path: string,
  opts: { intervalMs?: number; onMessage: (data: unknown) => void }
): { stop: () => void } {
  const ms = opts.intervalMs ?? 5000
  let stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const res = await fetch(path, { credentials: 'include' })
      if (res.ok) opts.onMessage(await res.json())
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
