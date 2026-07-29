/**
 * Composition engine — z-order, clustering, opacity by layer count.
 */

import type { ChartEvent, ChartEventSeverity, LayerId } from './types'

export const LAYER_Z_ORDER: LayerId[] = [
  'price',
  'liquidity',
  'holders',
  'ai', // zones render as background behind markers
  'developer',
  'security', // always topmost markers
  'narrative',
]

const CLUSTER_PX = 4

export type ClusteredMarker = {
  id: string
  timestamp: number
  price: number
  xPx: number
  yPx: number
  count: number
  severity: ChartEventSeverity
  events: ChartEvent[]
  /** Dominant layer for icon styling */
  primaryLayer: LayerId
}

/**
 * Project events to screen space via caller-provided time/price → px mappers,
 * then collapse events within ~4px into stacked markers with count badges.
 */
export function clusterEvents(
  events: ChartEvent[],
  project: (ev: ChartEvent) => { xPx: number; yPx: number } | null,
): ClusteredMarker[] {
  const projected: { ev: ChartEvent; xPx: number; yPx: number }[] = []
  for (const ev of events) {
    const p = project(ev)
    if (!p) continue
    projected.push({ ev, ...p })
  }
  projected.sort((a, b) => a.xPx - b.xPx || a.yPx - b.yPx)

  const used = new Set<number>()
  const clusters: ClusteredMarker[] = []

  for (let i = 0; i < projected.length; i++) {
    if (used.has(i)) continue
    const seed = projected[i]!
    const group = [seed]
    used.add(i)
    for (let j = i + 1; j < projected.length; j++) {
      if (used.has(j)) continue
      const other = projected[j]!
      const dx = other.xPx - seed.xPx
      const dy = other.yPx - seed.yPx
      if (Math.hypot(dx, dy) <= CLUSTER_PX) {
        group.push(other)
        used.add(j)
      }
    }
    const eventsIn = group.map((g) => g.ev)
    const severity = maxSeverity(eventsIn.map((e) => e.severity))
    const primary = pickPrimaryLayer(eventsIn)
    const ax = group.reduce((s, g) => s + g.xPx, 0) / group.length
    const ay = group.reduce((s, g) => s + g.yPx, 0) / group.length
    clusters.push({
      id: `cluster:${eventsIn.map((e) => e.id).join('|')}`,
      timestamp: seed.ev.timestamp,
      price: seed.ev.price,
      xPx: ax,
      yPx: ay,
      count: eventsIn.length,
      severity,
      events: eventsIn,
      primaryLayer: primary,
    })
  }
  return clusters
}

function maxSeverity(list: ChartEventSeverity[]): ChartEventSeverity {
  if (list.includes('critical')) return 'critical'
  if (list.includes('notable')) return 'notable'
  return 'info'
}

function pickPrimaryLayer(events: ChartEvent[]): LayerId {
  const rank: LayerId[] = ['security', 'developer', 'ai', 'liquidity', 'holders', 'narrative']
  for (const id of rank) {
    if (events.some((e) => e.layerId === id)) return id
  }
  return events[0]?.layerId ?? 'narrative'
}

/**
 * Non-critical marker opacity falls as more overlay layers are toggled on.
 * Critical + security markers are exempt (always full opacity).
 */
export function markerOpacityForLayerCount(
  enabledOverlayCount: number,
  severity: ChartEventSeverity,
  layerId: LayerId,
): number {
  if (severity === 'critical' || layerId === 'security') return 1
  if (enabledOverlayCount <= 1) return 1
  if (enabledOverlayCount === 2) return 0.9
  if (enabledOverlayCount === 3) return 0.78
  if (enabledOverlayCount === 4) return 0.68
  return 0.58
}

/** Visible events for timeline — respects layer toggles (narrative pulls from visible layers). */
export function eventsForTimeline(
  allEvents: ChartEvent[],
  visibility: Partial<Record<LayerId, boolean>>,
): ChartEvent[] {
  return allEvents
    .filter((e) => {
      if (e.layerId === 'price') return false
      if (e.layerId === 'narrative') {
        // Narrative entries appear when narrative toggle is on
        return visibility.narrative === true
      }
      return visibility[e.layerId] === true
    })
    .sort((a, b) => a.timestamp - b.timestamp)
}

/** Events drawn as markers on canvas (excludes pure narrative-only if desired). */
export function eventsForCanvas(
  allEvents: ChartEvent[],
  visibility: Partial<Record<LayerId, boolean>>,
): ChartEvent[] {
  return allEvents.filter((e) => {
    if (e.layerId === 'price' || e.layerId === 'narrative') return false
    if (e.layerId === 'ai') return false // AI uses zones + strip, not markers
    return visibility[e.layerId] === true
  })
}
