'use client'

/**
 * Live whale marquee channel — EventSource (SSE) primary, HTTP poll fallback.
 * Merges into a capped ring buffer for thousands of events without DOM bloat.
 */

import { useEffect, useRef, useState } from 'react'
import {
  WHALE_HIGH_CONFIDENCE_MIN,
  filterHighConfidenceWhales,
  mergeWhaleRing,
} from '@/features/terminal-os/shared/lib/enrich-whale-movement'
import { liveWhaleFeedProvider } from '@/features/terminal-os/shared/lib/live-providers'
import type { WhaleMovement } from '@/features/terminal-os/shared/types'

type ConnState = 'connecting' | 'live' | 'polling' | 'error'

function parseItems(data: unknown): WhaleMovement[] {
  if (!data || typeof data !== 'object') return []
  const items = (data as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items as WhaleMovement[]
}

export function useWhaleMarqueeStream(opts?: {
  minConfidence?: number
  pollMs?: number
}) {
  const minConfidence = opts?.minConfidence ?? WHALE_HIGH_CONFIDENCE_MIN
  const pollMs = opts?.pollMs ?? 8_000
  const [events, setEvents] = useState<WhaleMovement[]>([])
  const [conn, setConn] = useState<ConnState>('connecting')
  const [error, setError] = useState<string | null>(null)
  const bufferRef = useRef<WhaleMovement[]>([])

  useEffect(() => {
    let stopped = false
    let es: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let pollFallback: (() => void) | null = null

    const ingest = (incoming: WhaleMovement[]) => {
      if (stopped || incoming.length === 0) return
      bufferRef.current = mergeWhaleRing(bufferRef.current, incoming)
      setEvents(filterHighConfidenceWhales(bufferRef.current, minConfidence))
      setError(null)
    }

    const startPoll = () => {
      setConn('polling')
      const tick = async () => {
        if (stopped) return
        try {
          const items = await liveWhaleFeedProvider.getRecentMovements(32)
          ingest(items)
        } catch (e) {
          if (!stopped) {
            setError(e instanceof Error ? e.message : 'Whale poll failed')
            setConn('error')
          }
        }
      }
      void tick()
      pollTimer = setInterval(() => void tick(), pollMs)
    }

    const wsUrl = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TERMINAL_OS_WHALE_WS_URL : undefined

    if (wsUrl) {
      try {
        const ws = new WebSocket(wsUrl)
        ws.onopen = () => {
          if (!stopped) setConn('live')
        }
        ws.onmessage = (ev) => {
          try {
            ingest(parseItems(JSON.parse(String(ev.data))))
          } catch {
            /* ignore malformed */
          }
        }
        ws.onerror = () => {
          ws.close()
        }
        ws.onclose = () => {
          if (!stopped) startPoll()
        }
        pollFallback = () => ws.close()
        return () => {
          stopped = true
          pollFallback?.()
          if (pollTimer) clearInterval(pollTimer)
        }
      } catch {
        /* fall through to SSE */
      }
    }

    try {
      es = new EventSource('/api/terminal-os/whales/stream')
      es.addEventListener('ready', () => {
        if (!stopped) setConn('live')
      })
      es.addEventListener('whales', (ev) => {
        try {
          ingest(parseItems(JSON.parse((ev as MessageEvent).data)))
          if (!stopped) setConn('live')
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('error', () => {
        /* EventSource fires error on retry; if closed, fall back */
        if (es?.readyState === EventSource.CLOSED && !stopped) {
          es.close()
          es = null
          startPoll()
        }
      })
      // Safety: if SSE never delivers within 4s, poll
      const safety = setTimeout(() => {
        if (!stopped && bufferRef.current.length === 0) {
          es?.close()
          es = null
          startPoll()
        }
      }, 4_000)
      return () => {
        stopped = true
        clearTimeout(safety)
        es?.close()
        if (pollTimer) clearInterval(pollTimer)
      }
    } catch {
      startPoll()
      return () => {
        stopped = true
        if (pollTimer) clearInterval(pollTimer)
      }
    }
  }, [minConfidence, pollMs])

  return { events, conn, error, isLoading: events.length === 0 && conn !== 'error' }
}
