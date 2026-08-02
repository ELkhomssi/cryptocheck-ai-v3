'use client'

/**
 * Continuously evaluates active alert rules.
 * Prefers SSE (/api/terminal-os/alerts/stream) for real-time push; falls back to POST poll.
 * ai_signal rules resolve from the server Decision store — not client-only Decision state.
 */

import { useEffect } from 'react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTickerQuotes } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import type { FiredAlert } from '@/lib/terminal-os/alert-types'

export function AlertEvaluateBridge() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const { data: quotes } = useTickerQuotes()

  useEffect(() => {
    if (!wallet) return

    let es: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let stopped = false

    const emit = (fired: FiredAlert[]) => {
      for (const f of fired) {
        window.dispatchEvent(new CustomEvent('ccai:tos:alert', { detail: f }))
      }
    }

    const pollOnce = async () => {
      if (stopped) return
      const prices: Record<string, number> = {}
      for (const q of quotes?.items ?? []) {
        prices[q.symbol] = q.priceUsd
      }
      if (focused?.priceUsd && focused.id) prices[focused.id] = focused.priceUsd
      if (focused?.symbol && focused.priceUsd) prices[focused.symbol] = focused.priceUsd
      // Prices optional — server loads Decision store for ai_signal rules
      try {
        const res = await fetch('/api/terminal-os/alerts/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet, prices }),
        })
        if (!res.ok) return
        const body = (await res.json()) as { fired?: FiredAlert[] }
        emit(body.fired ?? [])
      } catch {
        /* best-effort */
      }
    }

    const startPoll = () => {
      void pollOnce()
      poll = setInterval(() => void pollOnce(), 15_000)
    }

    try {
      es = new EventSource(
        `/api/terminal-os/alerts/stream?wallet=${encodeURIComponent(wallet)}`,
      )
      es.addEventListener('alert', (ev) => {
        try {
          const body = JSON.parse((ev as MessageEvent).data) as { fired?: FiredAlert[] }
          emit(body.fired ?? [])
        } catch {
          /* ignore */
        }
      })
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED) {
          es.close()
          es = null
          if (!stopped) startPoll()
        }
      }
    } catch {
      startPoll()
    }

    return () => {
      stopped = true
      es?.close()
      if (poll) clearInterval(poll)
    }
  }, [wallet, quotes, focused])

  return null
}
