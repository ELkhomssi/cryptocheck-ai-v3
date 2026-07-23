'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import type { DiscoverToken } from '@/lib/trading-terminal/data/types'
import { applyDexQuotes, fetchDexQuotes } from '@/lib/trading-terminal/discover-enrich'
import { useTerminalFocus } from './TerminalFocusProvider'

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-[var(--tit-pos)]' : 'bg-[var(--tit-warn)]'}`}
      aria-hidden
    />
  )
}

export function TerminalStatusBar() {
  const { isConnected } = useSolana()
  const { dataMode, selectMint, focusMint, focusSymbol } = useTerminalFocus()
  const [latency, setLatency] = useState<number | null>(null)
  const [status, setStatus] = useState<'ok' | 'degraded'>('ok')
  const [liveTicker, setLiveTicker] = useState<DiscoverToken[]>([])
  const [clock, setClock] = useState(() => new Date())
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const demoMovers =
    dataMode === 'demo' && snap.discover.status === 'ready'
      ? snap.discover.data.slice(0, 8)
      : []
  const movers = dataMode === 'demo' ? demoMovers : liveTicker

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (dataMode === 'demo') {
      setLatency(42)
      setStatus('ok')
      return
    }
    let cancelled = false
    const tick = async () => {
      const t0 = performance.now()
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        const ms = Math.round(performance.now() - t0)
        if (cancelled) return
        setLatency(ms)
        const body = (await res.json().catch(() => ({}))) as { status?: string }
        setStatus(res.ok && body.status === 'healthy' ? 'ok' : 'degraded')
      } catch {
        if (!cancelled) {
          setStatus('degraded')
          setLatency(null)
        }
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [dataMode])

  useEffect(() => {
    if (dataMode !== 'live') {
      setLiveTicker([])
      return
    }
    let cancelled = false
    const SOL = 'So11111111111111111111111111111111111111112'
    const seeds: DiscoverToken[] = [
      {
        mint: SOL,
        symbol: 'SOL',
        name: 'Solana',
        priceUsd: 0,
        changePct: 0,
        marketCapUsd: 0,
        views: 0,
        badge: null,
      },
    ]
    if (focusMint && focusMint.length >= 32 && !focusMint.startsWith('Demo')) {
      seeds.push({
        mint: focusMint,
        symbol: focusSymbol || focusMint.slice(0, 4),
        name: focusSymbol || focusMint.slice(0, 4),
        priceUsd: 0,
        changePct: 0,
        marketCapUsd: 0,
        views: 0,
        badge: null,
      })
    }
    void fetchDexQuotes(seeds.map((s) => s.mint)).then((q) => {
      if (cancelled) return
      setLiveTicker(applyDexQuotes(seeds, q).filter((t) => t.priceUsd > 0 || t.changePct !== 0))
    })
    return () => {
      cancelled = true
    }
  }, [dataMode, focusMint, focusSymbol])

  const utc = clock.toISOString().slice(11, 19)

  return (
    <footer
      className="tit-area-status flex items-center gap-4 overflow-x-auto border-t border-[var(--tit-border)] bg-white px-6 text-[0.75rem] font-medium text-[var(--tit-text-2)]"
      style={{ height: 'var(--tit-footer)' }}
    >
      <span className="flex shrink-0 items-center gap-2">
        <StatusDot ok={(isConnected || dataMode === 'demo') && status === 'ok'} />
        <span className="text-[var(--tit-text-1)]">
          {dataMode === 'demo' || isConnected ? 'Wallet linked' : 'Connect wallet'}
        </span>
      </span>

      <span className="hidden h-3 w-px bg-[var(--tit-border)] sm:block" aria-hidden />

      <span className="flex shrink-0 items-center gap-2">
        <StatusDot ok={status === 'ok'} />
        <span className="text-[var(--tit-text-1)]">Solana</span>
        <span className={latency != null && latency < 120 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'}>
          {latency != null ? `${latency}ms` : '…'}
        </span>
      </span>

      <span className="hidden h-3 w-px bg-[var(--tit-border)] lg:block" aria-hidden />

      <span className="flex shrink-0 items-center gap-2">
        <StatusDot ok={status === 'ok'} />
        <span className={status === 'ok' ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'}>
          Market {status === 'ok' ? 'open' : 'degraded'}
        </span>
      </span>

      {movers.length > 0 ? (
        <div className="hidden min-w-0 flex-1 overflow-hidden lg:block">
          <div className="animate-[tit-ticker_40s_linear_infinite] whitespace-nowrap">
            {[...movers, ...movers].map((m, i) => (
              <button
                key={`${m.mint}-${i}`}
                type="button"
                className="mr-5"
                onClick={() => selectMint(m.mint, m.symbol)}
              >
                <span className="font-semibold text-[var(--tit-text-0)]">{m.symbol}</span>{' '}
                {m.priceUsd > 0 ? (
                  <span className="text-[var(--tit-text-1)]">
                    ${m.priceUsd < 1 ? m.priceUsd.toPrecision(3) : m.priceUsd.toFixed(2)}{' '}
                  </span>
                ) : null}
                <span className={m.changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'}>
                  {m.changePct >= 0 ? '+' : ''}
                  {m.changePct.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <span className="hidden text-[var(--tit-text-2)] lg:inline">Market tape</span>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-4">
        <span className="hidden text-[var(--tit-text-2)] sm:inline">{utc} UTC</span>
        <span className="text-[var(--tit-text-2)]">Not financial advice · DYOR</span>
      </span>
    </footer>
  )
}
