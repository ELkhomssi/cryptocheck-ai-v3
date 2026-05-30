'use client'

import { useEffect, useState } from 'react'

/**
 * SOL/USD from market API; refreshes on visibility + initial load (not random interval bots).
 * For sub-second marks, extend with Jupiter price websocket when available.
 */
export function useSolPriceWs() {
  const [solUsd, setSolUsd] = useState(168)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/web4-terminal/market', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { solUsd?: number }
        if (!cancelled && typeof data.solUsd === 'number' && data.solUsd > 0) {
          setSolUsd(data.solUsd)
        }
      } catch {
        /* keep last */
      }
    }

    void load()
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return solUsd
}
