'use client'

/**
 * useTickerPolling — Phase 4D
 *
 * While a report is on screen, re-fetches the ticker slice every
 * `intervalMs` (default 10s) via `actions.scanTicker(mint)`.
 *
 * Behavior:
 *   - Pauses when `document.hidden` (user on another tab)
 *   - Skips first tick on mount (we already have fresh data)
 *   - Resets cleanly on mint change
 *   - No-ops when `mint` is null
 */

import { useEffect } from 'react'
import { useTerminal } from '../TerminalProvider'

export function useTickerPolling(
  mint: string | null,
  intervalMs = 10_000
) {
  const { actions } = useTerminal()

  useEffect(() => {
    if (!mint) return
    if (typeof document === 'undefined') return

    let cancelled = false

    const tick = () => {
      if (cancelled) return
      if (document.hidden) return
      void actions.scanTicker(mint)
    }

    const id = window.setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [mint, intervalMs, actions])
}
