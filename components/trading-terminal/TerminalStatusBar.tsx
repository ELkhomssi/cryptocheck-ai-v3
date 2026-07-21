'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import type { DiscoverToken } from '@/lib/trading-terminal/data/types'
import { applyDexQuotes, fetchDexQuotes } from '@/lib/trading-terminal/discover-enrich'
import { useTerminalFocus } from './TerminalFocusProvider'

export function TerminalStatusBar() {
  const { isConnected } = useSolana()
  const { dataMode, selectMint, focusMint, focusSymbol } = useTerminalFocus()
  const [latency, setLatency] = useState<number | null>(null)
  const [status, setStatus] = useState<'ok' | 'degraded'>('ok')
  const [liveTicker, setLiveTicker] = useState<DiscoverToken[]>([])
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const demoMovers =
    dataMode === 'demo' && snap.discover.status === 'ready'
      ? snap.discover.data.slice(0, 8)
      : []
  const hot =
    dataMode === 'demo' && snap.discover.status === 'ready'
      ? snap.discover.data.find((d) => d.badge === 'HOT')
      : null

  const movers = dataMode === 'demo' ? demoMovers : liveTicker

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

  // Live ticker: enrich focus + a few well-known SOL liquid names via DexScreener when feed sparse
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

  return (
    <footer
      className="tit-area-status flex items-center gap-3 overflow-x-auto border-t border-[var(--tit-border)] bg-[var(--tit-bg-0)] px-3 tit-mono text-[0.55rem] text-[var(--tit-text-2)]"
      style={{ height: 'var(--tit-footer)' }}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            (isConnected || dataMode === 'demo') && status === 'ok'
              ? 'bg-[var(--tit-pos)]'
              : 'bg-[var(--tit-warn)]'
          }`}
        />
        {dataMode === 'demo' || isConnected ? 'CONNECTED' : 'WALLET OFF'}
      </span>
      <span>Solana {latency != null ? `${latency}ms` : 'connecting…'}</span>
      {dataMode === 'demo' ? (
        <>
          <span>Block 312,847,291</span>
          <span>TPS 1,352</span>
        </>
      ) : null}
      <span className={status === 'ok' ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'}>
        {status === 'ok' ? 'SYSTEMS OK' : 'DEGRADED'}
      </span>
      {movers.length > 0 ? (
        <div className="hidden min-w-0 flex-1 overflow-hidden lg:block">
          <div className="animate-[tit-ticker_40s_linear_infinite] whitespace-nowrap">
            {movers.map((m) => (
              <span key={m.mint} className="mr-4">
                <span className="text-[var(--tit-text-0)]">{m.symbol}</span>{' '}
                {m.priceUsd > 0 ? (
                  <span className="text-[var(--tit-text-1)]">
                    ${m.priceUsd < 1 ? m.priceUsd.toPrecision(3) : m.priceUsd.toFixed(2)}{' '}
                  </span>
                ) : null}
                <span className={m.changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'}>
                  {m.changePct >= 0 ? '+' : ''}
                  {m.changePct.toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <span className="hidden text-[var(--tit-text-2)] lg:inline">Market ticker · connecting…</span>
      )}
      {hot ? (
        <button
          type="button"
          onClick={() => selectMint(hot.mint, hot.symbol)}
          className="hidden shrink-0 items-center gap-1 rounded border border-[var(--tit-hot)]/40 bg-[var(--tit-hot)]/10 px-2 py-0.5 text-[var(--tit-hot)] xl:inline-flex"
        >
          LAUNCHLAB HOT · {hot.symbol}
          <span className="underline">View</span>
        </button>
      ) : null}
      {dataMode === 'demo' ? <span className="shrink-0">Uptime 99.98%</span> : null}
      <span className="ml-auto shrink-0 text-[var(--tit-text-2)]">
        Not financial advice · DYOR · Non-custodial
      </span>
      <style jsx global>{`
        @keyframes tit-ticker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </footer>
  )
}
