'use client'

/**
 * Continuously evaluates active alert rules against live ticker prices
 * while a wallet session is connected (not only on the Alerts nav).
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

    const tick = async () => {
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
        for (const f of body.fired ?? []) {
          window.dispatchEvent(new CustomEvent('ccai:tos:alert', { detail: f }))
        }
      } catch {
        /* best-effort */
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 15_000)
    return () => window.clearInterval(id)
  }, [wallet, quotes, focused])

  return null
}
