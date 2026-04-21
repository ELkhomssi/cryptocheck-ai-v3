'use client'

import { createPollFallback } from '@/services/market-stream/poll-fallback'

type Handlers = { onOpen?: () => void; onClose?: () => void; onError?: (e: Event) => void; onMessage?: (d: unknown) => void }

/**
 * Browser WebSocket with reconnect + optional 5s poll fallback if `wsUrl` empty.
 */
export class TradingOsConnection {
  private ws: WebSocket | null = null
  private pollStop: (() => void) | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false

  constructor(
    private readonly wsUrl: string | undefined,
    private readonly pollPath: string | undefined,
    private readonly handlers: Handlers
  ) {}

  start() {
    this.closed = false
    if (this.wsUrl) this.openWs()
    else if (this.pollPath) {
      this.pollStop = createPollFallback(this.pollPath, { onMessage: (d) => this.handlers.onMessage?.(d) }).stop
    }
  }

  private openWs() {
    if (!this.wsUrl || this.closed) return
    try {
      this.ws = new WebSocket(this.wsUrl)
      this.ws.onopen = () => this.handlers.onOpen?.()
      this.ws.onclose = () => {
        this.handlers.onClose?.()
        if (!this.closed) this.scheduleReconnect()
      }
      this.ws.onerror = (e) => this.handlers.onError?.(e)
      this.ws.onmessage = (ev) => {
        try {
          this.handlers.onMessage?.(JSON.parse(String(ev.data)))
        } catch {
          this.handlers.onMessage?.(ev.data)
        }
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.closed) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.openWs(), 2500)
  }

  stop() {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.pollStop?.()
    this.ws?.close()
    this.ws = null
  }
}
