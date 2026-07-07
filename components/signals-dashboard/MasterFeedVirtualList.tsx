'use client'

import { useEffect, useRef, useState } from 'react'
import { FixedSizeList, type ListChildComponentProps } from 'react-window'
import { Radio } from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { EmptyState } from '@/components/command-center/EmptyState'
import { SkeletonRows } from '@/components/command-center/SkeletonRows'
import { SignalFeedRow } from './SignalFeedRow'

const ROW_HEIGHT = 76

type RowData = {
  signals: Map<string, UnifiedSignal>
  orderedIds: string[]
  recentIds: Set<string>
  delayedBy: Map<string, number>
  onSwap: (s: UnifiedSignal) => void
}

function FeedRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const id = data.orderedIds[index]
  const signal = id ? data.signals.get(id) : undefined
  if (!signal) return <div style={style} />
  return (
    <SignalFeedRow
      signal={signal}
      style={style}
      isRecent={data.recentIds.has(signal.id)}
      delayedBySec={data.delayedBy.get(signal.id)}
      onSwap={data.onSwap}
    />
  )
}

type Props = {
  signals: Map<string, UnifiedSignal>
  orderedIds: string[]
  recentIds: Set<string>
  delayedBy: Map<string, number>
  onSwap: (s: UnifiedSignal) => void
  onPauseChange: (paused: boolean) => void
  loading: boolean
}

export function MasterFeedVirtualList({
  signals,
  orderedIds,
  recentIds,
  delayedBy,
  onSwap,
  onPauseChange,
  loading,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(480)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setHeight(Math.max(320, el.clientHeight))
    })
    ro.observe(el)
    setHeight(Math.max(320, el.clientHeight))
    return () => ro.disconnect()
  }, [])

  const itemData: RowData = { signals, orderedIds, recentIds, delayedBy, onSwap }

  if (loading && orderedIds.length === 0) {
    return <SkeletonRows rows={8} className="h-[min(70vh,560px)]" />
  }

  if (!orderedIds.length) {
    return (
      <EmptyState
        icon={Radio}
        title="No signals in view"
        detail="Try All sources, or wait for ingestion and gate workers to publish the next event."
        className="h-[min(70vh,560px)]"
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className="rd-panel h-[min(70vh,560px)] overflow-hidden"
      onMouseEnter={() => onPauseChange(true)}
      onMouseLeave={() => onPauseChange(false)}
    >
      <FixedSizeList
        height={height}
        width="100%"
        itemCount={orderedIds.length}
        itemSize={ROW_HEIGHT}
        itemData={itemData}
        overscanCount={6}
      >
        {FeedRow}
      </FixedSizeList>
    </div>
  )
}
