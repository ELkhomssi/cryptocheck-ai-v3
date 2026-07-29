'use client'

import type { ChartTool, LayerId, LayerStatus } from '../types'
import { LAYER_META } from '../types'

const TOOLS: { id: ChartTool; label: string }[] = [
  { id: 'crosshair', label: 'Crosshair' },
  { id: 'measure', label: 'Measure' },
  { id: 'replay', label: 'Replay' },
  { id: 'compare', label: 'Compare' },
  { id: 'screenshot', label: 'Screenshot' },
]

export function LeftTools({
  tool,
  onTool,
}: {
  tool: ChartTool
  onTool: (t: ChartTool) => void
}) {
  return (
    <div className="ic-left-tools" role="toolbar" aria-label="Chart tools">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="ic-tool-btn"
          data-active={tool === t.id}
          onClick={() => onTool(t.id)}
          title={t.label}
        >
          {t.label.slice(0, 2)}
        </button>
      ))}
    </div>
  )
}

export function LayerToggles({
  layers,
  onToggle,
}: {
  layers: { id: LayerId; status: LayerStatus; visible: boolean }[]
  onToggle: (id: LayerId) => void
}) {
  return (
    <div className="ic-layer-toggles" role="group" aria-label="Intelligence layers">
      {layers
        .filter((l) => l.id !== 'price')
        .map((l) => {
          const meta = LAYER_META[l.id as Exclude<LayerId, 'price'>]
          const noData = l.status === 'no_data'
          return (
            <button
              key={l.id}
              type="button"
              className="ic-layer-toggle"
              data-active={l.visible && !noData}
              data-nodata={noData}
              disabled={noData}
              onClick={() => onToggle(l.id)}
              title={noData ? `${meta.label} — No data yet` : meta.label}
            >
              <span>{meta.label}</span>
              {noData ? <span className="ic-nodata">No data yet</span> : null}
            </button>
          )
        })}
    </div>
  )
}
