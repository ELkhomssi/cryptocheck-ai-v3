/**
 * Client SSE connector for Terminal OS — reconnects on soft-close / errors
 * before falling back to HTTP poll. Avoids treating Vercel soft-close as hard failure.
 */

export type TerminalOsSseHandlers = {
  onEvent?: (event: string, data: string) => void
  onReady?: () => void
  onReconnect?: () => void
  /** Called only after reconnect budget is exhausted. */
  onGiveUp?: () => void
}

export type TerminalOsSseHandle = {
  close: () => void
}

const DEFAULT_MAX_RECONNECTS = 8

export function connectTerminalOsSse(
  url: string,
  handlers: TerminalOsSseHandlers,
  opts?: { maxReconnects?: number; namedEvents?: string[] },
): TerminalOsSseHandle {
  const maxReconnects = opts?.maxReconnects ?? DEFAULT_MAX_RECONNECTS
  const namedEvents = opts?.namedEvents ?? []
  let stopped = false
  let es: EventSource | null = null
  let reconnects = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
  }

  const teardownEs = () => {
    if (!es) return
    for (const name of namedEvents) {
      es.removeEventListener(name, onNamed as EventListener)
    }
    es.removeEventListener('ready', onReady as EventListener)
    es.removeEventListener('reconnect', onReconnectEvt as EventListener)
    es.onerror = null
    es.close()
    es = null
  }

  const onNamed = (ev: Event) => {
    const me = ev as MessageEvent
    handlers.onEvent?.(me.type, String(me.data ?? ''))
  }

  const onReady = () => {
    reconnects = 0
    handlers.onReady?.()
  }

  const scheduleReconnect = (delayMs: number) => {
    if (stopped) return
    clearRetry()
    if (reconnects >= maxReconnects) {
      handlers.onGiveUp?.()
      return
    }
    reconnects += 1
    handlers.onReconnect?.()
    retryTimer = setTimeout(() => {
      if (!stopped) open()
    }, delayMs)
  }

  const onReconnectEvt = (ev: Event) => {
    let delay = 250
    try {
      const body = JSON.parse(String((ev as MessageEvent).data ?? '{}')) as { retryMs?: number }
      if (typeof body.retryMs === 'number' && body.retryMs >= 0) delay = body.retryMs
    } catch {
      /* ignore */
    }
    teardownEs()
    scheduleReconnect(delay)
  }

  const open = () => {
    if (stopped) return
    teardownEs()
    try {
      es = new EventSource(url)
      es.addEventListener('ready', onReady as EventListener)
      es.addEventListener('reconnect', onReconnectEvt as EventListener)
      for (const name of namedEvents) {
        es.addEventListener(name, onNamed as EventListener)
      }
      es.onerror = () => {
        if (stopped) return
        // CONNECTING = browser auto-retry; CLOSED = dead — rotate ourselves
        if (es && es.readyState === EventSource.CLOSED) {
          teardownEs()
          scheduleReconnect(Math.min(8_000, 400 * reconnects || 400))
        }
      }
    } catch {
      scheduleReconnect(1_000)
    }
  }

  open()

  return {
    close: () => {
      stopped = true
      clearRetry()
      teardownEs()
    },
  }
}
