'use client'

/**
 * Terminal market SSE — server pushes; client paints <200ms.
 * Updates TanStack Query cache so panels stay in sync without browser→3P polling.
 */

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { MarketOverview, TickerQuote, WhaleMovement } from '@/features/terminal-os/shared/types'

export type StreamMeta = {
  stale?: boolean
  demo?: boolean
  ageSec?: number
  source?: string
}

export function useTerminalMarketStream() {
  const qc = useQueryClient()
  const [meta, setMeta] = useState<{
    ticker?: StreamMeta
    overview?: StreamMeta
    whales?: StreamMeta
    connected: boolean
  }>({ connected: false })
  const lastPaint = useRef(0)

  useEffect(() => {
    let es: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let stopped = false

    const apply = (payload: {
      ticker?: TickerQuote[]
      overview?: MarketOverview | null
      whales?: WhaleMovement[]
      meta?: { ticker?: StreamMeta; overview?: StreamMeta; whales?: StreamMeta }
    }) => {
      const now = performance.now()
      // Throttle UI updates to ~10/sec max even if SSE is chatty
      if (now - lastPaint.current < 100) return
      lastPaint.current = now

      if (payload.ticker) {
        qc.setQueryData(['tos', 'ticker'], payload.ticker)
      }
      if (payload.overview) {
        qc.setQueryData(['tos', 'overview'], payload.overview)
      }
      if (payload.whales) {
        qc.setQueryData(['tos', 'whales', 32], payload.whales)
        qc.setQueryData(['tos', 'whales', 16], payload.whales)
        qc.setQueryData(['tos', 'whales', 10], payload.whales)
      }
      setMeta({
        connected: true,
        ticker: payload.meta?.ticker,
        overview: payload.meta?.overview,
        whales: payload.meta?.whales,
      })
    }

    const startPoll = () => {
      const tick = async () => {
        if (stopped) return
        try {
          const [t, o] = await Promise.all([
            fetch('/api/terminal-os/feed?resource=ticker', { cache: 'no-store' }).then((r) => r.json()),
            fetch('/api/terminal-os/feed?resource=overview', { cache: 'no-store' }).then((r) => r.json()),
          ])
          apply({
            ticker: t.items,
            overview: t.item ?? o.item,
            meta: {
              ticker: { stale: t.stale, demo: t.demo, ageSec: t.ageSec, source: t.source },
              overview: { stale: o.stale, demo: o.demo, ageSec: o.ageSec, source: o.source },
            },
          })
        } catch {
          /* soft */
        }
      }
      void tick()
      poll = setInterval(() => void tick(), 5_000)
    }

    try {
      es = new EventSource('/api/terminal-os/stream')
      es.addEventListener('ready', () => setMeta((m) => ({ ...m, connected: true })))
      es.addEventListener('market', (ev) => {
        try {
          apply(JSON.parse((ev as MessageEvent).data))
        } catch {
          /* ignore */
        }
      })
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED) {
          es.close()
          es = null
          startPoll()
        }
      }
    } catch {
      startPoll()
    }

    // Warm cache once on mount
    void fetch('/api/terminal-os/feed?resource=warm', { cache: 'no-store' }).catch(() => undefined)

    return () => {
      stopped = true
      es?.close()
      if (poll) clearInterval(poll)
    }
  }, [qc])

  return meta
}
