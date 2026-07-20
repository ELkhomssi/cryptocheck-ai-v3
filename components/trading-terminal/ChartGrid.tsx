'use client'

import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { TIT_DND_MIME } from '@/lib/trading-terminal/constants'
import { decodeTitDrag } from '@/lib/trading-terminal/dnd'
import type { ChartMode } from '@/lib/trading-terminal/constants'
import { useTerminalFocus } from './TerminalFocusProvider'

function gridClass(mode: ChartMode): string {
  if (mode === 1) return 'grid-cols-1 grid-rows-1'
  if (mode === 2) return 'grid-cols-2 grid-rows-1'
  if (mode === 4) return 'grid-cols-2 grid-rows-2'
  return 'grid-cols-3 grid-rows-2'
}

function ChartSlot({ index }: { index: number }) {
  const {
    slots,
    activeSlot,
    setActiveSlot,
    toggleSlotLock,
    focusMint,
    loadMintToSlot,
    swapSlots,
    selectMint,
  } = useTerminalFocus()
  const slot = slots[index]
  const mint = slot?.mint ?? ''
  const symbol = slot?.symbol ?? ''
  const locked = slot?.locked ?? false
  const active = index === activeSlot
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        setActiveSlot(index)
        if (mint) selectMint(mint, symbol)
      }}
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
      className={`tit-panel relative flex min-h-0 flex-col overflow-hidden ${
        active ? 'ring-1 ring-[var(--tit-ember)]' : ''
      } ${dragOver ? 'ring-2 ring-[var(--tit-ember)]' : ''}`}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/[0.06] px-2">
        <span className="tit-mono text-[0.65rem] font-semibold text-[var(--tit-text-0)]">
          {symbol || '—'}
        </span>
        <span className="tit-mono truncate text-[0.55rem] text-[var(--tit-text-2)]">
          {mint ? `${mint.slice(0, 6)}…` : 'Drop a symbol'}
        </span>
        <button
          type="button"
          className="ml-auto rounded p-1 text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]"
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
        <iframe
          title={`Chart ${symbol || mint}`}
          src={`https://dexscreener.com/solana/${mint}?embed=1&theme=dark&trades=0&info=0`}
          className="min-h-0 flex-1 border-0 bg-[var(--tit-bg-0)]"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center text-xs text-[var(--tit-text-1)]">
          <span>{dragOver ? 'Release to load' : 'Drop token here'}</span>
          <span className="text-[0.65rem] text-[var(--tit-text-2)]">
            {focusMint ? 'Or click Discover / press Enter' : 'Select a token in Discover'}
          </span>
        </div>
      )}
    </div>
  )
}

export function ChartGrid() {
  const { chartMode, slots } = useTerminalFocus()

  return (
    <div className={`grid min-h-0 flex-1 gap-2 ${gridClass(chartMode)}`}>
      {slots.map((_, i) => (
        <div key={i} className="min-h-0">
          <ChartSlot index={i} />
        </div>
      ))}
    </div>
  )
}
