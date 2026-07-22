'use client'

/**
 * Primary institutional chart — single full-height pane (no multi-widget grid).
 */

import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import {
  CHART_TIMEFRAMES,
  type ChartTimeframe,
} from '@/lib/trading-terminal/chart-engine'
import { buildChartOverlays } from '@/lib/trading-terminal/chart-overlays'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import {
  fetchLiveOhlcv,
  mapDemoSeedCandles,
  type OhlcvResult,
} from '@/lib/trading-terminal/ohlcv-feed'
import { loadTradeLog } from '@/lib/trading-terminal/trade-log'
import {
  CandlestickChart,
  type ChartTradeMark,
  type CrosshairOhlc,
} from './CandlestickChart'
import { useTerminalFocus } from './TerminalFocusProvider'

function fmtPx(n: number): string {
  if (n < 0.0001) return n.toExponential(2)
  if (n < 0.01) return n.toPrecision(4)
  if (n < 1) return n.toFixed(5)
  return n.toFixed(4)
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(0)
}

function useFocusOhlcv(
  mint: string,
  symbol: string,
  timeframe: ChartTimeframe,
  dataMode: 'demo' | 'live',
): OhlcvResult {
  const [live, setLive] = useState<OhlcvResult>({ status: 'loading' })

  const demo = useMemo(() => {
    if (dataMode !== 'demo' || !mint) return null
    const snap = getTerminalSnapshot('demo')
    if (snap.charts.status !== 'ready') return null
    const slot = snap.charts.data.find((c) => c.mint === mint) ?? snap.charts.data[0]
    if (!slot) return null
    const candles = mapDemoSeedCandles(slot.candles)
    return {
      status: 'ready' as const,
      candles,
      lastPrice: slot.lastPrice,
      changePct: slot.changePct,
      source: 'demo' as const,
    }
  }, [dataMode, mint])

  useEffect(() => {
    if (dataMode === 'demo' || !mint || mint.length < 32) {
      setLive({ status: 'unavailable', reason: 'No symbol loaded.' })
      return
    }
    let cancelled = false
    setLive({ status: 'loading' })
    void fetchLiveOhlcv({ mint, symbol, timeframe }).then((r) => {
      if (!cancelled) setLive(r)
    })
    return () => {
      cancelled = true
    }
  }, [dataMode, mint, symbol, timeframe])

  if (dataMode === 'demo') {
    return demo ?? { status: 'unavailable', reason: 'No symbol loaded.' }
  }
  return live
}

export function PrimaryChart() {
  const {
    focusMint,
    focusSymbol,
    dataMode,
    addToWatchlist,
    watchlists,
    activeWatchlistId,
  } = useTerminalFocus()
  const [tf, setTf] = useState<ChartTimeframe>('15m')
  const [overlayToggles, setOverlayToggles] = useState({
    structure: true,
    smartMoney: true,
    zones: true,
  })
  const [hover, setHover] = useState<CrosshairOhlc>(null)

  const mint = focusMint
  const symbol = focusSymbol
  const ohlcv = useFocusOhlcv(mint, symbol, tf, dataMode)

  const tradeMarks: ChartTradeMark[] = useMemo(() => {
    if (!mint) return []
    if (dataMode === 'demo') {
      const snap = getTerminalSnapshot('demo')
      if (snap.trades.status !== 'ready') return []
      return snap.trades.data
        .filter((t) => t.mint === mint)
        .map((t) => ({
          time: Math.floor(Date.parse(t.at) / 1000),
          side: t.side,
          label: t.side === 'buy' ? 'B' : 'S',
        }))
    }
    return loadTradeLog()
      .filter((t) => t.mint === mint)
      .map((t) => ({
        time: Math.floor(Date.parse(t.at) / 1000),
        side: t.side,
        label: t.side === 'buy' ? 'B' : 'S',
      }))
  }, [dataMode, mint])

  const overlays = useMemo(() => {
    if (ohlcv.status !== 'ready') {
      return null
    }
    return buildChartOverlays({
      candles: ohlcv.candles,
      mint,
      mode: dataMode,
      tradeMarks,
    })
  }, [ohlcv, mint, dataMode, tradeMarks])

  const eventMarks = useMemo(() => {
    if (!overlays) return []
    return overlays.events.filter((e) => {
      if (!overlayToggles.structure && e.kind === 'structure') return false
      if (
        !overlayToggles.smartMoney &&
        (e.kind === 'smart_money_buy' ||
          e.kind === 'smart_money_sell' ||
          e.kind === 'whale' ||
          e.kind === 'large_buy' ||
          e.kind === 'large_sell' ||
          e.kind === 'risk')
      ) {
        return false
      }
      return true
    })
  }, [overlays, overlayToggles])

  const zones = overlayToggles.zones ? overlays?.zones ?? [] : []

  const onList = watchlists
    .find((l) => l.id === activeWatchlistId)
    ?.items.some((i) => i.mint === mint)

  const lastPrice = ohlcv.status === 'ready' ? ohlcv.lastPrice : null
  const changePct = ohlcv.status === 'ready' ? ohlcv.changePct : null
  const bias = overlays?.structure.bias ?? 'neutral'
  const ohlc = hover
  const barUp = ohlc ? ohlc.close >= ohlc.open : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[var(--tit-border)] bg-[rgba(5,7,10,0.72)] shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
      {/* Chart header */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--tit-border)] bg-[rgba(11,17,24,0.65)] px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="tit-display truncate text-[1.1rem] font-semibold tracking-tight text-[var(--tit-text-0)]">
              {symbol ? `${symbol}/SOL` : 'Select symbol'}
            </h2>
            {symbol ? (
              <span className="tit-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--tit-text-2)]">
                Primary
              </span>
            ) : null}
            {bias !== 'neutral' ? (
              <span
                className={`tit-mono rounded-md border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide ${
                  bias === 'bullish'
                    ? 'border-[var(--tit-pos)]/35 bg-[var(--tit-pos)]/10 text-[var(--tit-pos)]'
                    : 'border-[var(--tit-neg)]/35 bg-[var(--tit-neg)]/10 text-[var(--tit-neg)]'
                }`}
              >
                {bias === 'bullish' ? 'Bullish structure' : 'Bearish structure'}
              </span>
            ) : null}
          </div>
          <p className="tit-mono mt-0.5 text-[0.55rem] text-[var(--tit-text-2)]">
            {overlays?.methodNote ?? 'Awaiting series'}
          </p>
        </div>

        {lastPrice != null ? (
          <div className="ml-1">
            <p className="tit-mono text-[1.25rem] font-bold leading-none text-[var(--tit-text-0)]">
              ${fmtPx(lastPrice)}
            </p>
            {changePct != null ? (
              <p
                className={`tit-mono mt-0.5 text-[0.72rem] font-semibold ${
                  changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                }`}
              >
                {changePct >= 0 ? '+' : ''}
                {changePct.toFixed(2)}%
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Crosshair OHLC HUD */}
        {ohlc ? (
          <div
            className={`tit-mono hidden items-center gap-3 rounded-md border px-2.5 py-1.5 text-[0.62rem] lg:flex ${
              barUp
                ? 'border-[var(--tit-pos)]/25 bg-[var(--tit-pos)]/8'
                : 'border-[var(--tit-neg)]/25 bg-[var(--tit-neg)]/8'
            }`}
          >
            <span>
              <span className="text-[var(--tit-text-2)]">O </span>
              <span className="text-[var(--tit-text-0)]">{fmtPx(ohlc.open)}</span>
            </span>
            <span>
              <span className="text-[var(--tit-text-2)]">H </span>
              <span className="text-[var(--tit-pos)]">{fmtPx(ohlc.high)}</span>
            </span>
            <span>
              <span className="text-[var(--tit-text-2)]">L </span>
              <span className="text-[var(--tit-neg)]">{fmtPx(ohlc.low)}</span>
            </span>
            <span>
              <span className="text-[var(--tit-text-2)]">C </span>
              <span className={barUp ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'}>
                {fmtPx(ohlc.close)}
              </span>
            </span>
            {ohlc.volume > 0 ? (
              <span>
                <span className="text-[var(--tit-text-2)]">V </span>
                <span className="text-[var(--tit-text-0)]">{fmtVol(ohlc.volume)}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {CHART_TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTf(t)}
              className={`tit-mono rounded-md px-2 py-1 text-[0.62rem] font-semibold transition-colors ${
                tf === t
                  ? 'bg-[var(--tit-accent)]/15 text-[var(--tit-accent-bright)] ring-1 ring-[var(--tit-accent)]/35'
                  : 'text-[var(--tit-text-2)] hover:bg-white/[0.04] hover:text-[var(--tit-text-0)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="rounded-md p-1.5 text-[var(--tit-text-2)] transition-colors hover:bg-white/[0.04] hover:text-[var(--tit-accent)] disabled:opacity-40"
          aria-label="Add to watchlist"
          disabled={!mint}
          onClick={() => {
            if (!mint) return
            addToWatchlist({ mint, symbol: symbol || mint.slice(0, 6) })
          }}
        >
          <Star
            className="h-3.5 w-3.5"
            fill={onList ? 'var(--tit-accent)' : 'none'}
            stroke={onList ? 'var(--tit-accent)' : 'currentColor'}
          />
        </button>
      </div>

      {/* Overlay legend / toggles */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--tit-border-subtle)] px-3 py-1.5">
        <span className="tit-section-title !mr-1">Overlays</span>
        {(
          [
            ['structure', 'BOS / CHoCH'],
            ['smartMoney', 'Smart money'],
            ['zones', 'Zones'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setOverlayToggles((t) => ({ ...t, [key]: !t[key] }))}
            className={`tit-mono rounded-full border px-2 py-0.5 text-[0.55rem] font-semibold transition-colors ${
              overlayToggles[key]
                ? 'border-[var(--tit-accent)]/35 bg-[var(--tit-accent)]/10 text-[var(--tit-accent-bright)]'
                : 'border-[var(--tit-border)] text-[var(--tit-text-2)]'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="tit-mono ml-auto hidden text-[0.5rem] text-[var(--tit-text-2)] sm:inline">
          Scroll · drag · pinch
        </span>
      </div>

      {/* Chart canvas */}
      <div className="relative min-h-0 flex-1">
        {!mint ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="tit-display text-[1.1rem] text-[var(--tit-text-0)]">No symbol loaded</p>
            <p className="max-w-sm text-[0.75rem] text-[var(--tit-text-1)]">
              Search a contract or select from the watchlist to open the primary intelligence chart.
            </p>
          </div>
        ) : ohlcv.status === 'loading' ? (
          <div className="tit-skeleton h-full w-full opacity-35" />
        ) : ohlcv.status === 'building' ? (
          <div className="flex h-full items-center justify-center text-[0.75rem] text-[var(--tit-text-1)]">
            Building history…
          </div>
        ) : ohlcv.status === 'unavailable' ? (
          <div className="flex h-full items-center justify-center text-[0.75rem] text-[var(--tit-text-1)]">
            {ohlcv.reason}
          </div>
        ) : (
          <CandlestickChart
            candles={ohlcv.candles}
            eventMarks={eventMarks}
            zones={zones}
            onCrosshair={setHover}
          />
        )}
      </div>
    </div>
  )
}
