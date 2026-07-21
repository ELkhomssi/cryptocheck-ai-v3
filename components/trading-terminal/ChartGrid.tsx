'use client'

import { useEffect, useMemo, useState } from 'react'
import { Expand, Lock, Maximize2, Minimize2, Star, Unlock } from 'lucide-react'
import {
  CHART_TIMEFRAMES,
  type ChartTimeframe,
} from '@/lib/trading-terminal/chart-engine'
import { CHART_MODES, TIT_DND_MIME, type ChartMode } from '@/lib/trading-terminal/constants'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { decodeTitDrag } from '@/lib/trading-terminal/dnd'
import {
  fetchLiveOhlcv,
  mapDemoSeedCandles,
  type OhlcvResult,
} from '@/lib/trading-terminal/ohlcv-feed'
import { loadTradeLog } from '@/lib/trading-terminal/trade-log'
import { CandlestickChart, type ChartTradeMark } from './CandlestickChart'
import { useTerminalFocus } from './TerminalFocusProvider'

/** Per-slot default TFs — denser multi-pane look (reference terminal). */
const SLOT_DEFAULT_TF: ChartTimeframe[] = ['5m', '5m', '15m', '1H', '5m', '15m']

const LINK_COLORS = ['#22D3EE', '#7C5CFF', '#F97316', '#22C55E', '#EAB308', '#F04438'] as const

function gridClass(mode: ChartMode): string {
  if (mode === 1) return 'grid-cols-1 grid-rows-1'
  if (mode === 2) return 'grid-cols-2 grid-rows-1'
  if (mode === 4) return 'grid-cols-2 grid-rows-2'
  return 'grid-cols-3 grid-rows-2'
}

function useSlotOhlcv(
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
    const slot = snap.charts.data.find((c) => c.mint === mint)
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

function ChartSlot({
  index,
  timeframe,
  linkGroup,
  maximized,
  onMaximize,
}: {
  index: number
  timeframe: ChartTimeframe
  linkGroup: number
  maximized: number | null
  onMaximize: (i: number | null) => void
}) {
  const {
    slots,
    activeSlot,
    setActiveSlot,
    toggleSlotLock,
    loadMintToSlot,
    swapSlots,
    selectMint,
    addToWatchlist,
    dataMode,
  } = useTerminalFocus()
  const slot = slots[index]
  const mint = slot?.mint ?? ''
  const symbol = slot?.symbol ?? ''
  const locked = slot?.locked ?? false
  const active = index === activeSlot
  const [dragOver, setDragOver] = useState(false)
  const ohlcv = useSlotOhlcv(mint, symbol, timeframe, dataMode)

  const marks: ChartTradeMark[] = useMemo(() => {
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

  if (maximized != null && maximized !== index) return null

  const lastPrice = ohlcv.status === 'ready' ? ohlcv.lastPrice : null
  const changePct = ohlcv.status === 'ready' ? ohlcv.changePct : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        setActiveSlot(index)
        if (mint) selectMint(mint, symbol)
      }}
      onDoubleClick={() => onMaximize(maximized === index ? null : index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setActiveSlot(index)
          if (mint) selectMint(mint, symbol)
        }
      }}
      onDragOver={(e) => {
        if (locked) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (locked) return
        const fromSlot = e.dataTransfer.getData('application/x-ccai-tit-slot')
        if (fromSlot !== '') {
          const a = Number(fromSlot)
          if (Number.isFinite(a)) swapSlots(a, index)
          return
        }
        const payload =
          decodeTitDrag(e.dataTransfer.getData(TIT_DND_MIME)) ||
          decodeTitDrag(e.dataTransfer.getData('text/plain'))
        if (payload) loadMintToSlot(payload.mint, payload.symbol, index)
      }}
      draggable={Boolean(mint) && !locked}
      onDragStart={(e) => {
        if (!mint || locked) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('application/x-ccai-tit-slot', String(index))
        e.dataTransfer.setData(TIT_DND_MIME, JSON.stringify({ mint, symbol }))
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`relative flex min-h-0 flex-col overflow-hidden border border-[var(--tit-border)] bg-[var(--tit-bg-1)] ${
        active ? 'border-[var(--tit-accent)]' : ''
      } ${dragOver ? 'border-[var(--tit-accent)]' : ''} ${
        maximized === index ? 'col-span-full row-span-full' : ''
      }`}
    >
      <div
        className="flex shrink-0 items-center gap-1 border-b border-[var(--tit-border)] px-1.5"
        style={{ height: 'var(--tit-chart-header-h)' }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: LINK_COLORS[linkGroup % LINK_COLORS.length] }}
          title="Link group"
          aria-hidden
        />
        <span className="tit-mono text-[0.6rem] font-semibold text-[var(--tit-text-0)]">
          {symbol ? `${symbol}/SOL` : '—'}
        </span>
        <span className="tit-mono text-[0.45rem] text-[var(--tit-text-2)]">{timeframe}</span>
        {lastPrice != null ? (
          <span className="tit-mono text-[0.6rem] font-semibold text-[var(--tit-text-0)]">
            ${lastPrice < 0.01 ? lastPrice.toPrecision(3) : lastPrice.toFixed(4)}
          </span>
        ) : null}
        {changePct != null ? (
          <span
            className={`tit-mono text-[0.5rem] ${
              changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
            }`}
          >
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        ) : null}
        <button
          type="button"
          className="ml-auto rounded p-0.5 text-[var(--tit-text-2)] hover:text-[var(--tit-accent)]"
          aria-label="Add to watchlist"
          disabled={!mint}
          onClick={(e) => {
            e.stopPropagation()
            if (!mint) return
            addToWatchlist({ mint, symbol: symbol || mint.slice(0, 6) })
          }}
        >
          <Star className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]"
          aria-label={maximized === index ? 'Restore' : 'Maximize'}
          onClick={(e) => {
            e.stopPropagation()
            onMaximize(maximized === index ? null : index)
          }}
        >
          {maximized === index ? (
            <Minimize2 className="h-3 w-3" />
          ) : (
            <Maximize2 className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]"
          aria-label={locked ? 'Unlock chart' : 'Lock chart'}
          onClick={(e) => {
            e.stopPropagation()
            toggleSlotLock(index)
          }}
        >
          {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
      </div>

      {!mint ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-3 text-center text-xs text-[var(--tit-text-1)]">
          <span>{dragOver ? 'Release to load symbol' : 'No symbol loaded'}</span>
          <span className="text-[0.65rem] text-[var(--tit-text-2)]">
            Search a CA or pick from Opportunity Radar.
          </span>
        </div>
      ) : ohlcv.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="tit-skeleton h-full w-full opacity-40" />
        </div>
      ) : ohlcv.status === 'building' ? (
        <div className="flex flex-1 items-center justify-center text-[0.7rem] text-[var(--tit-text-1)]">
          Building history…
        </div>
      ) : ohlcv.status === 'unavailable' ? (
        <div className="flex flex-1 items-center justify-center text-[0.7rem] text-[var(--tit-text-1)]">
          {ohlcv.reason}
        </div>
      ) : (
        <CandlestickChart candles={ohlcv.candles} marks={marks} />
      )}
    </div>
  )
}

export function ChartGrid() {
  const { chartMode, slots, setChartMode, dataMode, activeSlot } = useTerminalFocus()
  const [slotTfs, setSlotTfs] = useState<ChartTimeframe[]>(() => [...SLOT_DEFAULT_TF])
  const [linkGroup, setLinkGroup] = useState(0)
  const [maximized, setMaximized] = useState<number | null>(null)
  const activeTf = slotTfs[activeSlot] ?? '5m'

  const setActiveTimeframe = (tf: ChartTimeframe) => {
    setSlotTfs((prev) => {
      const next = [...prev]
      while (next.length < slots.length) next.push('5m')
      next[activeSlot] = tf
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <div
        className={`grid min-h-0 flex-1 ${
          maximized != null ? 'grid-cols-1 grid-rows-1' : gridClass(chartMode)
        }`}
        style={{ gap: 'var(--tit-chart-gap)' }}
      >
        {slots.map((_, i) => (
          <div key={i} className="min-h-0">
            <ChartSlot
              index={i}
              timeframe={slotTfs[i] ?? SLOT_DEFAULT_TF[i % SLOT_DEFAULT_TF.length]!}
              linkGroup={linkGroup}
              maximized={maximized}
              onMaximize={setMaximized}
            />
          </div>
        ))}
      </div>

      <div className="flex h-6 shrink-0 items-center gap-1 border-t border-[var(--tit-border)] px-1">
        <div className="flex items-center gap-0.5" role="group" aria-label="Chart layout">
          {CHART_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMaximized(null)
                setChartMode(m as ChartMode)
              }}
              className={`tit-mono h-5 w-5 rounded text-[0.55rem] font-bold ${
                chartMode === m
                  ? 'bg-[var(--tit-accent)] text-[#041016]'
                  : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="tit-label mx-1">TF</span>
        {CHART_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setActiveTimeframe(tf)}
            className={`tit-mono rounded px-1 py-0.5 text-[0.5rem] ${
              activeTf === tf
                ? 'bg-[var(--tit-accent)]/20 text-[var(--tit-accent-bright)]'
                : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-1)]'
            }`}
          >
            {tf}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto tit-mono text-[0.45rem] text-[var(--tit-text-2)]"
          title="Link group"
          onClick={() => setLinkGroup((g) => (g + 1) % LINK_COLORS.length)}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: LINK_COLORS[linkGroup] }}
          />
        </button>
        <span className="tit-mono text-[0.45rem] text-[var(--tit-text-2)]">
          {dataMode === 'demo' ? 'demo' : 'live'}
        </span>
        <button
          type="button"
          className="rounded p-0.5 text-[var(--tit-text-2)]"
          aria-label="Maximize chart"
          onClick={() => setMaximized((m) => (m == null ? 0 : null))}
        >
          <Expand className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
