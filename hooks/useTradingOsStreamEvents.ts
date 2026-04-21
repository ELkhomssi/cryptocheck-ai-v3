'use client'

import { useEffect, useState } from 'react'
import { TradingOsConnection } from '@/services/websocket'
import {
  TRADING_OS_STREAM_EVENTS_PATH,
  isTradingOsStreamEventsResponse,
  type TradingOsStreamEventsResponse,
} from '@/lib/trading-os/stream-events'

type StreamState = {
  data: TradingOsStreamEventsResponse | null
  pollHttpError: number | null
}

/**
 * Subscribes to Trading OS stream ticks via HTTP poll (or WS when `NEXT_PUBLIC_TRADING_WS_URL` is set).
 */
export function useTradingOsStreamEvents(enabled: boolean): StreamState {
  const [data, setData] = useState<TradingOsStreamEventsResponse | null>(null)
  const [pollHttpError, setPollHttpError] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setPollHttpError(null)
      return
    }

    const wsUrl =
      typeof process.env.NEXT_PUBLIC_TRADING_WS_URL === 'string' && process.env.NEXT_PUBLIC_TRADING_WS_URL.length > 0
        ? process.env.NEXT_PUBLIC_TRADING_WS_URL
        : undefined

    const conn = new TradingOsConnection(wsUrl, TRADING_OS_STREAM_EVENTS_PATH, {
      onMessage: (raw) => {
        if (isTradingOsStreamEventsResponse(raw)) {
          setData(raw)
          setPollHttpError(null)
          return
        }
        if (raw && typeof raw === 'object' && (raw as { ok?: unknown }).ok === false) {
          const msg = (raw as { error?: unknown }).error
          setPollHttpError(500)
          setData(null)
          if (process.env.NODE_ENV === 'development' && msg) {
            console.warn('[TradingOsStream]', msg)
          }
        }
      },
      onPollError: (status) => {
        setPollHttpError(status)
        if (status === 401) setData(null)
      },
    })
    conn.start()
    return () => conn.stop()
  }, [enabled])

  return { data, pollHttpError }
}
