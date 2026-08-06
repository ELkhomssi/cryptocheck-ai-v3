/**
 * Shared SSE helpers for Terminal OS streams on Vercel serverless.
 *
 * Vercel kills long-lived functions at maxDuration (300s on Pro) and logs
 * "Vercel Runtime Timeout Error". Soft-close earlier with a `reconnect` event
 * so clients rotate cleanly and those errors disappear.
 */

export const SSE_MAX_DURATION_SEC = 300
/** Soft-close before the hard kill — leave headroom for final enqueue + close. */
export const SSE_SOFT_CLOSE_MS = 240_000

export const SSE_RESPONSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
} as const

export type SseSend = (event: string, data: unknown) => void

export type CreateSseStreamOptions = {
  onStart?: (send: SseSend) => void | Promise<void>
  onTick: (send: SseSend) => void | Promise<void>
  intervalMs: number
  tickImmediately?: boolean
  sendReady?: boolean
  readyPayload?: Record<string, unknown>
  softCloseMs?: number
}

/**
 * ReadableStream that heartbeats on an interval and soft-closes before Vercel timeout.
 */
export function createSseStream(options: CreateSseStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const softCloseMs = options.softCloseMs ?? SSE_SOFT_CLOSE_MS
  const tickImmediately = options.tickImmediately !== false
  const sendReady = options.sendReady !== false

  let closed = false
  let timer: ReturnType<typeof setInterval> | null = null
  let softTimer: ReturnType<typeof setTimeout> | null = null
  let tickInFlight = false
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null

  const cleanup = () => {
    closed = true
    if (timer) clearInterval(timer)
    if (softTimer) clearTimeout(softTimer)
    timer = null
    softTimer = null
  }

  const send: SseSend = (event, data) => {
    if (closed || !controllerRef) return
    try {
      controllerRef.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    } catch {
      cleanup()
    }
  }

  const closeGracefully = (reason: string) => {
    if (closed) return
    send('reconnect', { reason, at: Date.now(), retryMs: 250 })
    cleanup()
    try {
      controllerRef?.close()
    } catch {
      /* already closed */
    }
  }

  return new ReadableStream({
    async start(controller) {
      controllerRef = controller
      softTimer = setTimeout(() => closeGracefully('soft_close'), softCloseMs)

      try {
        if (sendReady) {
          send('ready', { ok: true, at: Date.now(), ...(options.readyPayload ?? {}) })
        }
        if (options.onStart) {
          await options.onStart(send)
        }

        const tick = async () => {
          if (closed || tickInFlight) return
          tickInFlight = true
          try {
            await options.onTick(send)
          } catch (e) {
            send('error', { message: e instanceof Error ? e.message : 'stream tick failed' })
          } finally {
            tickInFlight = false
          }
        }

        if (tickImmediately) await tick()
        if (!closed) {
          timer = setInterval(() => void tick(), options.intervalMs)
        }
      } catch (e) {
        send('error', { message: e instanceof Error ? e.message : 'stream failed to start' })
        closeGracefully('start_error')
      }
    },
    cancel() {
      cleanup()
    },
  })
}

/**
 * Lower-level helper when a route needs custom control (e.g. attention seq watch).
 */
export function attachSseLifecycle(
  controller: ReadableStreamDefaultController<Uint8Array>,
  opts?: { softCloseMs?: number; readyPayload?: Record<string, unknown>; sendReady?: boolean },
) {
  const encoder = new TextEncoder()
  let closed = false
  const timers: Array<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>> = []

  const cleanup = () => {
    closed = true
    for (const t of timers) clearInterval(t as ReturnType<typeof setInterval>)
    timers.length = 0
  }

  const send: SseSend = (event, data) => {
    if (closed) return
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    } catch {
      cleanup()
    }
  }

  const closeGracefully = (reason: string) => {
    if (closed) return
    send('reconnect', { reason, at: Date.now(), retryMs: 250 })
    cleanup()
    try {
      controller.close()
    } catch {
      /* already closed */
    }
  }

  const soft = setTimeout(
    () => closeGracefully('soft_close'),
    opts?.softCloseMs ?? SSE_SOFT_CLOSE_MS,
  )
  timers.push(soft)

  if (opts?.sendReady !== false) {
    send('ready', { ok: true, at: Date.now(), ...(opts?.readyPayload ?? {}) })
  }

  return {
    send,
    isClosed: () => closed,
    closeGracefully,
    trackTimer: (t: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>) => {
      timers.push(t)
    },
    cancel: cleanup,
  }
}
