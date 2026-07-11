'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SignalFeedEvent, SignalFeedFilter, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { ConnectionState } from '@/components/command-center/ConnectionPill'
import { matchesFeedFilter } from '@/lib/signals-dashboard/format'
import {
  FEED_LOAD_TIMEOUT_MS,
  type FeedLoadState,
} from '@/lib/signals-dashboard/feed-load-state'

export type FeedTier = 'free' | 'premium'

function sortIds(signals: Map<string, UnifiedSignal>, filter: SignalFeedFilter): string[] {
  return [...signals.values()]
    .filter((s) => matchesFeedFilter(s, filter))
    .sort((a, b) => new Date(b.msgTimestamp).getTime() - new Date(a.msgTimestamp).getTime())
    .map((s) => s.id)
}

function applyFeedEvent(
  signals: Map<string, UnifiedSignal>,
  event: SignalFeedEvent,
): Map<string, UnifiedSignal> {
  if (event.type === 'batch') {
    let next = signals
    for (const inner of event.events) {
      next = applyFeedEvent(next, inner)
    }
    return next
  }
  if (event.type === 'signal.remove') {
    const next = new Map(signals)
    next.delete(event.id)
    return next
  }
  const next = new Map(signals)
  next.set(event.signal.id, event.signal)
  return next
}

export function useSignalFeed(filter: SignalFeedFilter, opts?: { userId?: string; premiumToken?: string }) {
  const [signals, setSignals] = useState<Map<string, UnifiedSignal>>(new Map())
  const [tier, setTier] = useState<FeedTier>('free')
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [feedState, setFeedState] = useState<FeedLoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [degraded, setDegraded] = useState(false)
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set())
  const [delayedBy, setDelayedBy] = useState<Map<string, number>>(new Map())
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [feedMode, setFeedMode] = useState<'poll' | 'websocket' | null>(null)
  const [pollIntervalMs, setPollIntervalMs] = useState(20_000)
  const pausedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const hadSessionRef = useRef(false)
  const receivedLiveRef = useRef(false)
  const filterRef = useRef(filter)
  filterRef.current = filter

  const premiumToken = opts?.premiumToken
  const userId = opts?.userId

  const orderedIds = useMemo(() => sortIds(signals, filter), [signals, filter])

  const setPaused = useCallback((v: boolean) => {
    pausedRef.current = v
  }, [])

  const hasDataRef = useRef(false)
  const initialLoadDoneRef = useRef(false)

  const applyFeedLoadResult = useCallback((map: Map<string, UnifiedSignal>, ok: boolean) => {
    if (ok) {
      const hasRows = map.size > 0
      hasDataRef.current = hasRows
      setFeedState(hasRows ? 'data' : 'empty')
      setErrorMessage(null)
      setDegraded(false)
      return
    }
    if (!hasDataRef.current) {
      setFeedState('error')
    } else {
      setDegraded(true)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    const isInitial = !initialLoadDoneRef.current
    if (isInitial) {
      setFeedState('loading')
      setErrorMessage(null)
    }

    try {
      const params = new URLSearchParams()
      if (filter.chain) params.set('chain', filter.chain)
      if (filter.minVerdict) params.set('minVerdict', filter.minVerdict)
      if (filter.minSourceCount) params.set('minSourceCount', String(filter.minSourceCount))
      if (filter.search) params.set('search', filter.search)
      if (filter.sourceTag && filter.sourceTag !== 'all') params.set('sourceTag', filter.sourceTag)
      // Always send subjectType so the server can lane-filter BEFORE limit.
      params.set('subjectType', filter.subjectType ?? 'all')
      params.set('limit', '100')

      const headers: Record<string, string> = {}
      if (premiumToken) headers.authorization = `Bearer ${premiumToken}`

      const paramsWithUser = new URLSearchParams(params)
      if (userId) paramsWithUser.set('userId', userId)

      const res = await fetch(`/api/signals/history?${paramsWithUser.toString()}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(FEED_LOAD_TIMEOUT_MS),
      })
      const body = (await res.json()) as { signals?: UnifiedSignal[]; tier?: FeedTier; error?: string }
      if (!res.ok) throw new Error(body.error ?? `History load failed (${res.status})`)

      const map = new Map<string, UnifiedSignal>()
      for (const s of body.signals ?? []) {
        if (!s.dropped && !s.sample) map.set(s.id, s)
      }
      setSignals(map)
      setTier(body.tier ?? 'free')
      applyFeedLoadResult(map, true)
      if (feedMode === 'poll') setConnection('live')
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === 'TimeoutError' || e.message.includes('aborted')
            ? `Feed request timed out after ${FEED_LOAD_TIMEOUT_MS / 1000}s`
            : e.message
          : 'History load failed'
      console.error('[MasterFeed] history', e)
      setErrorMessage(msg)
      applyFeedLoadResult(new Map(), false)
      if (feedMode === 'poll' && !hasDataRef.current) setConnection('down')
    } finally {
      initialLoadDoneRef.current = true
    }
  }, [filter, premiumToken, userId, feedMode, applyFeedLoadResult])

  useEffect(() => {
    let cancelled = false
    fetch('/api/signals/runtime-config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { mode?: 'poll' | 'websocket'; wsUrl?: string | null; pollIntervalMs?: number }) => {
        if (cancelled) return
        const mode = j.mode === 'websocket' && j.wsUrl ? 'websocket' : 'poll'
        setFeedMode(mode)
        if (typeof j.pollIntervalMs === 'number' && j.pollIntervalMs > 0) {
          setPollIntervalMs(j.pollIntervalMs)
        }
        if (mode === 'websocket' && j.wsUrl) {
          setWsUrl(j.wsUrl)
        } else {
          setWsUrl(null)
          setConnection('listening')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeedMode('poll')
          setWsUrl(null)
          setConnection('listening')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (feedState !== 'loading') return
    const id = window.setTimeout(() => {
      setFeedState((s) => (s === 'loading' ? 'error' : s))
      setErrorMessage((m) => m ?? `Feed request timed out after ${FEED_LOAD_TIMEOUT_MS / 1000}s`)
      setConnection('down')
    }, FEED_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [feedState])

  // Vercel-native: poll Supabase-backed history (no WebSocket server required).
  useEffect(() => {
    if (feedMode !== 'poll') return
    const id = window.setInterval(() => {
      void loadHistory()
    }, pollIntervalMs)
    return () => window.clearInterval(id)
  }, [feedMode, pollIntervalMs, loadHistory])

  useEffect(() => {
    if (feedMode !== 'websocket' || !wsUrl) return
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const q = new URLSearchParams()
      if (userId) q.set('userId', userId)
      if (premiumToken) q.set('token', premiumToken)
      const url = q.toString() ? `${wsUrl}?${q.toString()}` : wsUrl

      setConnection((c) => {
        if (c === 'live' || c === 'listening') return 'reconnecting'
        return 'connecting'
      })
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        attemptRef.current = 0
        if (!hadSessionRef.current) setConnection('connecting')
        setDegraded(false)
        ws.send(JSON.stringify({ type: 'subscribe', filter: filterRef.current, userId }))
      }

      ws.onclose = () => {
        if (cancelled) return
        attemptRef.current += 1
        if (hadSessionRef.current) {
          setConnection(attemptRef.current > 3 ? 'down' : 'reconnecting')
        } else {
          setConnection(attemptRef.current > 3 ? 'down' : 'connecting')
        }
        setDegraded(true)
        if (!hasDataRef.current) {
          setFeedState('error')
          setErrorMessage('WebSocket connection lost')
        }
        const delay = Math.min(1000 * 2 ** Math.min(attemptRef.current, 4), 12_000)
        reconnectTimer.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        console.error('[MasterFeed] websocket error')
        setDegraded(true)
        if (!hasDataRef.current) {
          setFeedState('error')
          setErrorMessage('WebSocket connection failed')
        }
        ws.close()
      }

      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(String(msg.data)) as
            | SignalFeedEvent
            | { type: 'hello'; tier: FeedTier }
          if ('tier' in event && event.type === 'hello') {
            setTier(event.tier)
            hadSessionRef.current = true
            if (!receivedLiveRef.current) setConnection('listening')
            return
          }
          if (!('type' in event)) return

          receivedLiveRef.current = true
          setConnection('live')

          setSignals((prev) => {
            const feedEvent = event as SignalFeedEvent
            if (
              (feedEvent.type === 'signal.new' || feedEvent.type === 'signal.update') &&
              feedEvent.delayedBy
            ) {
              setDelayedBy((d) => new Map(d).set(feedEvent.signal.id, feedEvent.delayedBy!))
            }
            const next = applyFeedEvent(prev, feedEvent)
            if (event.type === 'signal.new' && !pausedRef.current) {
              const id = event.signal.id
              setRecentIds((r) => new Set([...r, id]))
              window.setTimeout(() => {
                setRecentIds((r) => {
                  const n = new Set(r)
                  n.delete(id)
                  return n
                })
              }, 1200)
            }
            hasDataRef.current = next.size > 0
            setFeedState(next.size > 0 ? 'data' : 'empty')
            setErrorMessage(null)
            return next
          })
        } catch {
          /* ignore malformed */
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [premiumToken, userId, wsUrl, feedMode])

  useEffect(() => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', filter }))
    }
  }, [filter])

  const loading = feedState === 'loading'

  return {
    signals,
    orderedIds,
    tier,
    connected: connection === 'live' || connection === 'listening',
    connection,
    loading,
    feedState,
    errorMessage,
    degraded,
    recentIds,
    delayedBy,
    setPaused,
    reload: loadHistory,
  }
}
