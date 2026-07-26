'use client'

import { useQuery } from '@tanstack/react-query'
import type { TickerQuote } from '@/types/portfolio-desk'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'

async function fetchTicker(): Promise<TickerQuote[]> {
  const res = await fetch('/api/portfolio/ticker', { cache: 'no-store' })
  if (!res.ok) return []
  const body = (await res.json()) as { quotes?: TickerQuote[] }
  return body.quotes ?? []
}

/** Poll Jupiter prices every 10s — scroll animation stays CSS-only. */
export function usePriceTicker() {
  return useQuery({
    queryKey: ['portfolio-ticker'],
    queryFn: fetchTicker,
    refetchInterval: 10_000,
    staleTime: 8_000,
  })
}

export function TickerTape() {
  const { data: quotes = [] } = usePriceTicker()

  if (!quotes.length) {
    return (
      <div className="pd-ticker" aria-label="Market ticker">
        <span className="pd-num" style={{ paddingLeft: 20, fontSize: 11, color: 'var(--text-faint)' }}>
          Awaiting live Jupiter quotes…
        </span>
      </div>
    )
  }

  const render = (prefix: string) =>
    quotes.map((q) => {
      const chg = q.change24hPct
      const up = chg == null ? true : chg >= 0
      return (
        <span key={`${prefix}-${q.mint}`} className="pd-tick">
          <span className="sym">{q.symbol}</span>
          <span className="pr pd-num">{formatUsd(q.priceUsd, q.priceUsd < 1)}</span>
          <span className={`chg ${up ? 'up' : 'down'} pd-num`}>
            {chg == null ? '·' : `${up ? '▲' : '▼'} ${formatPct(Math.abs(chg))}`}
          </span>
        </span>
      )
    })

  return (
    <div className="pd-ticker" aria-label="Market ticker">
      <div className="pd-ticker-track">
        {render('a')}
        {render('b')}
      </div>
    </div>
  )
}
