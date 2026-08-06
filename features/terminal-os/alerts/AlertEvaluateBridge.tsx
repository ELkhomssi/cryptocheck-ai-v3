'use client'

/**
 * Continuously evaluates active alert rules.
 * Prefers SSE; reconnects on soft-close; falls back to POST poll only if SSE gives up.
 */

import { useEffect } from 'react'
import { connectTerminalOsSse } from '@/features/terminal-os/shared/lib/sse-client'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTickerQuotes } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import type { FiredAlert } from '@/lib/terminal-os/alert-types'

export function AlertEvaluateBridge() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const { data: quotes } = useTickerQuotes()

  useEffect(() => {
    if (!wallet) return

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
      for (const q of quotes ?? []) {
        prices[q.symbol] = q.priceUsd
      }
      if (focused?.priceUsd && focused.id) prices[focused.id] = focused.priceUsd
      if (focused?.symbol && focused.priceUsd) prices[focused.symbol] = focused.priceUsd
      if (Object.keys(prices).length === 0) return
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
      if (poll) return
      void pollOnce()
      poll = setInterval(() => void pollOnce(), 15_000)
    }

    const handle = connectTerminalOsSse(
      `/api/terminal-os/alerts/stream?wallet=${encodeURIComponent(wallet)}`,
      {
        onEvent: (event, data) => {
          if (event !== 'alert') return
          try {
            const body = JSON.parse(data) as { fired?: FiredAlert[] }
            emit(body.fired ?? [])
          } catch {
            /* ignore */
          }
        },
        onGiveUp: () => {
          if (!stopped) startPoll()
        },
      },
      { namedEvents: ['alert'] },
    )

    return () => {
      stopped = true
      handle.close()
      if (poll) clearInterval(poll)
    }
  }, [wallet, quotes, focused])

  return null
}
