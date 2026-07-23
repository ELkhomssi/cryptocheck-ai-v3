'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import type { DiscoverToken } from '@/lib/trading-terminal/data/types'
import { applyDexQuotes, fetchDexQuotes } from '@/lib/trading-terminal/discover-enrich'
import { useTerminalFocus } from './TerminalFocusProvider'

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={ok ? 'tit-pulse' : 'tit-pulse-warn'} aria-hidden />
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
  const hot =
    dataMode === 'demo' && snap.discover.status === 'ready'
      ? snap.discover.data.find((d) => d.badge === 'HOT')
      : null

  const movers = dataMode === 'demo' ? demoMovers : liveTicker
  const whaleAlert =
    dataMode === 'demo' && snap.coach.status === 'ready'
      ? snap.coach.data.smartMoney?.notable?.[0] ?? null
      : null
  const riskAlert =
    dataMode === 'demo' && snap.coach.status === 'ready'
      ? snap.coach.data.threats?.[0] ?? null
      : null

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
      className="tit-area-status flex items-center gap-4 overflow-x-auto border-t border-[var(--tit-border)] bg-[var(--tit-bg-0)] px-4 tit-mono text-[0.6875rem] text-[var(--tit-text-2)]"
      style={{ height: 'var(--tit-footer)' }}
    >
      <span className="flex shrink-0 items-center gap-2">
        <StatusDot ok={(isConnected || dataMode === 'demo') && status === 'ok'} />
        <span className="text-[var(--tit-text-1)]">
          {dataMode === 'demo' || isConnected ? 'Wallet linked' : 'Wallet off'}
        </span>
      </span>

      <span className="hidden h-3 w-px bg-[var(--tit-border)] sm:block" aria-hidden />

      <span className="flex shrink-0 items-center gap-2">
        <StatusDot ok={status === 'ok'} />
        <span className="text-[var(--tit-text-1)]">Solana</span>
        <span className={latency != null && latency < 120 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'}>
          RPC {latency != null ? `${latency}ms` : '…'}
        </span>
      </span>

      {dataMode === 'demo' ? (
        <>
          <span className="hidden md:inline">Block 312,847,291</span>
          <span className="hidden md:inline">TPS 1,352</span>
        </>
      ) : null}

      <span className="hidden h-3 w-px bg-[var(--tit-border)] lg:block" aria-hidden />

      <span className="flex shrink-0 items-center gap-2">
        <StatusDot ok={status === 'ok'} />
        <span className={status === 'ok' ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'}>
          Market {status === 'ok' ? 'OPEN' : 'DEGRADED'}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <span className="tit-pulse-accent" aria-hidden />
        <span className="text-[var(--tit-text-1)]">AI Engine</span>
        <span className="text-[var(--tit-text-0)]">LIVE</span>
      </span>

      {whaleAlert ? (
        <span className="hidden shrink-0 items-center gap-1 text-[var(--tit-info)] xl:inline-flex">
          Whale · {whaleAlert}
        </span>
      ) : null}

      {riskAlert ? (
        <span className="hidden shrink-0 items-center gap-1 text-[var(--tit-warn)] 2xl:inline-flex">
          Risk · {riskAlert.symbol} {riskAlert.reason}
        </span>
      ) : null}

      {movers.length > 0 ? (
        <div className="hidden min-w-0 flex-1 overflow-hidden lg:block">
          <div className="animate-[tit-ticker_40s_linear_infinite] whitespace-nowrap">
            {[...movers, ...movers].map((m, i) => (
              <span key={`${m.mint}-${i}`} className="mr-5">
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
        <span className="hidden text-[var(--tit-text-2)] lg:inline">Market tape · connecting…</span>
      )}

      {hot ? (
        <button
          type="button"
          onClick={() => selectMint(hot.mint, hot.symbol)}
          className="hidden shrink-0 items-center gap-1 rounded border border-[var(--tit-hot)]/35 bg-[var(--tit-hot)]/10 px-2 py-0.5 text-[var(--tit-hot)] xl:inline-flex"
        >
          HOT · {hot.symbol}
          <span className="underline">View</span>
        </button>
      ) : null}

      <span className="ml-auto flex shrink-0 items-center gap-3">
        <span className="hidden text-[var(--tit-text-2)] sm:inline">{utc} UTC</span>
        <span className="text-[var(--tit-text-2)]">NFA · DYOR · Non-custodial</span>
      </span>
    </footer>
  )
}
