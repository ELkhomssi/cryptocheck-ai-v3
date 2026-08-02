'use client'

import { useCallback, useMemo, useState, startTransition, type ReactNode } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { PanelSkeleton, EmptyState, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { useIntelligenceChart } from '../hooks/useIntelligenceChart'
import { IntelligenceChartCanvas } from './IntelligenceChartCanvas'
import { IntelligenceSidebar } from './IntelligenceSidebar'
import { BottomTimeline } from './BottomTimeline'
import { LeftTools, LayerToggles } from './ChartControls'
import { eventsForTimeline } from '../composition'
import { getStateAtTimestamp } from '../lib/get-state-at-timestamp'
import type { ChartEvent, ChartTool, LayerId } from '../types'
import { DEFAULT_LAYER_VISIBILITY } from '../types'
import '../styles.css'

function ChartHost({ children }: { children: ReactNode }) {
  return <div className="ic-root">{children}</div>
}

/**
 * CryptoCheckAI Intelligence Visualization System — sole chart surface.
 * Price via Apache ECharts; every overlay traces to a real engine.
 */
export function IntelligenceChart({
  query,
  chain = 'all',
  onClose,
}: {
  query: string
  chain?: string
  onClose?: () => void
}) {
  const { data: bundle, isLoading, isError, isFetching } = useIntelligenceChart(query, chain)
  const [tool, setTool] = useState<ChartTool>('crosshair')
  const [visibility, setVisibility] = useState({ ...DEFAULT_LAYER_VISIBILITY, price: true })
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [crosshairTs, setCrosshairTs] = useState<number | null>(null)

  const onToggle = useCallback((id: LayerId) => {
    if (id === 'price') return
    setVisibility((v) => ({ ...v, [id]: !v[id] }))
  }, [])

  const timelineEvents = useMemo(() => {
    if (!bundle) return []
    const all = bundle.layers.flatMap((l) => l.events)
    return eventsForTimeline(all, visibility)
  }, [bundle, visibility])

  const scrubTs = tool === 'replay' ? playhead : crosshairTs
  const sidebarState = useMemo(() => {
    if (!bundle) return null
    if (scrubTs == null) {
      return bundle.sidebarTimeline[bundle.sidebarTimeline.length - 1] ?? null
    }
    return getStateAtTimestamp(bundle.sidebarTimeline, scrubTs)
  }, [bundle, scrubTs])

  const onJump = useCallback((ev: ChartEvent) => {
    startTransition(() => {
      setHighlightId(ev.id)
      setPlayhead(ev.timestamp)
      setTool('replay')
    })
  }, [])

  const onTool = useCallback((t: ChartTool) => {
    setTool(t)
    if (t === 'screenshot') {
      // Presentation-only: trigger print-friendly capture of chart region
      try {
        document.querySelector('.ic-shell')?.scrollIntoView({ block: 'nearest' })
      } catch {
        /* ignore */
      }
    }
  }, [])

  if (isLoading && !bundle) {
    return (
      <ChartHost>
        <Panel title="Intelligence Chart" live>
          <PanelSkeleton rows={8} />
        </Panel>
      </ChartHost>
    )
  }

  if (isError || !bundle) {
    return (
      <ChartHost>
        <Panel
          title="Intelligence Chart"
          action={
            onClose ? (
              <button type="button" className="tos-tab" onClick={onClose}>
                Clear focus
              </button>
            ) : null
          }
        >
          <EmptyState message="Could not resolve token for Intelligence Chart." />
        </Panel>
      </ChartHost>
    )
  }

  const layersForToggle = bundle.layers.map((l) => ({
    id: l.id,
    status: l.status,
    visible: l.id === 'price' ? true : Boolean(visibility[l.id as keyof typeof visibility]),
  }))

  const lastCandle = bundle.candles[bundle.candles.length - 1]
  const replayMax = lastCandle?.time ?? 0
  const replayMin = bundle.candles[0]?.time ?? 0

  return (
    <ChartHost>
      <Panel
        title={`Intelligence · $${bundle.token.symbol}`}
        live
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(bundle.stale || isFetching || (bundle.demo && !bundle.aiLive)) && (
              <StaleIndicator
                stale={bundle.stale}
                demo={Boolean(bundle.demo) && !bundle.aiLive}
                source={bundle.source}
              />
            )}
            {onClose ? (
              <button type="button" className="tos-tab" onClick={onClose}>
                Clear focus
              </button>
            ) : null}
          </div>
        }
      >
        <div className="ic-shell">
          <LeftTools tool={tool} onTool={onTool} />
          <div className="ic-main">
            <LayerToggles layers={layersForToggle} onToggle={onToggle} />
            <IntelligenceChartCanvas
              bundle={bundle}
              visibility={visibility}
              playhead={tool === 'replay' ? playhead : null}
              highlightEventId={highlightId}
              onCrosshairTime={setCrosshairTs}
            />
            {tool === 'replay' ? (
              <div className="ic-replay">
                <label>
                  Replay
                  <input
                    type="range"
                    min={replayMin}
                    max={replayMax}
                    value={playhead ?? replayMax}
                    onChange={(e) => setPlayhead(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : null}
            <BottomTimeline
              events={timelineEvents}
              onJump={onJump}
              activeId={highlightId}
            />
          </div>
          <IntelligenceSidebar
            state={sidebarState}
            symbol={bundle.token.symbol}
            live={tool !== 'replay' || playhead == null}
          />
        </div>
        <p className="ic-disclaimer">
          Not financial advice · DYOR · Layers without engine data stay disabled — never synthetic.
        </p>
      </Panel>
    </ChartHost>
  )
}
