'use client'

import { useState } from 'react'
import { Expand, Lock, Maximize2, Minimize2, Star, Unlock } from 'lucide-react'
import {
  CHART_TIMEFRAMES,
  dexscreenerEmbedUrl,
  type ChartTimeframe,
} from '@/lib/trading-terminal/chart-engine'
import { CHART_MODES, TIT_DND_MIME, type ChartMode } from '@/lib/trading-terminal/constants'
import { decodeTitDrag } from '@/lib/trading-terminal/dnd'
import { useTerminalFocus } from './TerminalFocusProvider'

const LINK_COLORS = ['#22D3EE', '#7C5CFF', '#F97316', '#22C55E', '#EAB308', '#F04438'] as const

function gridClass(mode: ChartMode): string {
  if (mode === 1) return 'grid-cols-1 grid-rows-1'
  if (mode === 2) return 'grid-cols-2 grid-rows-1'
  if (mode === 4) return 'grid-cols-2 grid-rows-2'
  return 'grid-cols-3 grid-rows-2'
}

function DexScreenerBody({ mint, symbol }: { mint: string; symbol: string }) {
  return (
    <iframe
      title={`Chart ${symbol || mint}`}
      src={dexscreenerEmbedUrl(mint)}
      className="min-h-0 flex-1 border-0 bg-[var(--tit-bg-0)]"
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  )
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
    focusMint,
    loadMintToSlot,
    swapSlots,
    selectMint,
    addToWatchlist,
  } = useTerminalFocus()
  const slot = slots[index]
  const mint = slot?.mint ?? ''
  const symbol = slot?.symbol ?? ''
  const locked = slot?.locked ?? false
  const active = index === activeSlot
  const [dragOver, setDragOver] = useState(false)

  if (maximized != null && maximized !== index) return null

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
      className={`tit-panel-flat relative flex min-h-0 flex-col overflow-hidden ${
        active ? 'ring-1 ring-[var(--tit-accent)]' : ''
      } ${dragOver ? 'ring-2 ring-[var(--tit-accent)]' : ''} ${
        maximized === index ? 'col-span-full row-span-full' : ''
      }`}
    >
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-[var(--tit-border)] px-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: LINK_COLORS[linkGroup % LINK_COLORS.length] }}
          title="Link group"
          aria-hidden
        />
        <span className="tit-mono text-[0.65rem] font-semibold text-[var(--tit-text-0)]">
          {symbol ? `${symbol}/SOL` : '—'}
        </span>
        <span className="tit-mono rounded bg-[var(--tit-bg-3)] px-1 text-[0.5rem] text-[var(--tit-text-2)]">
          {timeframe}
        </span>
        <span className="tit-mono truncate text-[0.5rem] text-[var(--tit-text-2)]">
          {mint ? `${mint.slice(0, 6)}…` : 'Drop a symbol'}
        </span>
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

      {mint ? (
        <DexScreenerBody mint={mint} symbol={symbol} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-3 text-center text-xs text-[var(--tit-text-1)]">
          <span>{dragOver ? 'Release to load symbol' : 'No symbol loaded'}</span>
          <span className="text-[0.65rem] text-[var(--tit-text-2)]">
            Select from Discover to analyze.
          </span>
        </div>
      )}
    </div>
  )
}

export function ChartGrid() {
  const { chartMode, slots, setChartMode } = useTerminalFocus()
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('5m')
  const [linkGroup, setLinkGroup] = useState(0)
  const [maximized, setMaximized] = useState<number | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-0.5">
        <p className="tit-label">Workspace</p>
        <div className="flex items-center gap-0.5" role="group" aria-label="Chart layout">
          {CHART_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMaximized(null)
                setChartMode(m as ChartMode)
              }}
              className={`tit-mono h-6 w-6 rounded text-[0.6rem] font-bold ${
                chartMode === m
                  ? 'bg-[var(--tit-accent)] text-[#041016]'
                  : 'bg-[var(--tit-bg-3)] text-[var(--tit-text-1)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="tit-mono rounded border border-[var(--tit-border)] px-1.5 py-0.5 text-[0.55rem] text-[var(--tit-text-2)]"
          title="Link group color"
          onClick={() => setLinkGroup((g) => (g + 1) % LINK_COLORS.length)}
        >
          Link
          <span
            className="ml-1 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: LINK_COLORS[linkGroup] }}
          />
        </button>
        <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
          Drag Discover · double-click to maximize
        </span>
        <button
          type="button"
          className="ml-auto rounded p-1 text-[var(--tit-text-2)]"
          aria-label="Fullscreen workspace"
          onClick={() => setMaximized((m) => (m == null ? 0 : null))}
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className={`grid min-h-0 flex-1 gap-1 ${
          maximized != null ? 'grid-cols-1 grid-rows-1' : gridClass(chartMode)
        }`}
      >
        {slots.map((_, i) => (
          <div key={i} className="min-h-0">
            <ChartSlot
              index={i}
              timeframe={timeframe}
              linkGroup={linkGroup}
              maximized={maximized}
              onMaximize={setMaximized}
            />
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-[var(--tit-border)] px-0.5 py-1">
        <span className="tit-label mr-1">TF</span>
        {CHART_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`tit-mono rounded px-1.5 py-0.5 text-[0.55rem] ${
              timeframe === tf
                ? 'bg-[var(--tit-accent)]/20 text-[var(--tit-accent-bright)]'
                : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-1)]'
            }`}
          >
            {tf}
          </button>
        ))}
        <span className="tit-mono ml-auto text-[0.45rem] text-[var(--tit-text-2)]">
          Timeframe · chart engine settings
        </span>
      </div>
    </div>
  )
}
