/**
 * Chart overlay builder — maps intel / structure / coach into chart props.
 * Demo: DEMO_SEED intel + measured inputs. Live: structure-only until feeds exist.
 * Never fabricates event markers in live mode.
 */

import { getTerminalSnapshot } from './data/adapters'
import type { IntelEvent, TerminalDataMode } from './data/types'
import { getDemoOpportunityInputs } from './engines/demo-opportunity-inputs'
import {
  detectMarketStructure,
  type MarketStructureResult,
  type StructureLabel,
} from './engines/market-structure'
import type { Candle } from './ohlcv-feed'

export type ChartEventMark = {
  time: number
  kind:
    | 'smart_money_buy'
    | 'smart_money_sell'
    | 'whale'
    | 'large_buy'
    | 'large_sell'
    | 'risk'
    | 'trade_buy'
    | 'trade_sell'
    | 'structure'
  label: string
  color: string
  position: 'aboveBar' | 'belowBar'
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square'
}

export type ChartPriceZone = {
  id: string
  price: number
  title: string
  color: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  axisLabelVisible?: boolean
}

export type ChartOverlayBundle = {
  events: ChartEventMark[]
  zones: ChartPriceZone[]
  structure: MarketStructureResult
  methodNote: string
}

function nearestTime(times: number[], t: number): number {
  if (!times.length) return t
  let best = times[0]!
  let bestDist = Math.abs(best - t)
  for (const x of times) {
    const d = Math.abs(x - t)
    if (d < bestDist) {
      best = x
      bestDist = d
    }
  }
  return best
}

function intelToMark(e: IntelEvent, times: number[]): ChartEventMark | null {
  const t = nearestTime(times, Math.floor(Date.parse(e.at) / 1000))
  switch (e.kind) {
    case 'smart_money_buy':
      return {
        time: t,
        kind: 'smart_money_buy',
        label: 'SM',
        color: '#2563EB',
        position: 'belowBar',
        shape: 'arrowUp',
      }
    case 'smart_money_sell':
      return {
        time: t,
        kind: 'smart_money_sell',
        label: 'SM',
        color: '#D97706',
        position: 'aboveBar',
        shape: 'arrowDown',
      }
    case 'whale_accumulation':
      return {
        time: t,
        kind: 'whale',
        label: 'WHALE',
        color: '#3B82F6',
        position: 'belowBar',
        shape: 'circle',
      }
    case 'large_buy':
      return {
        time: t,
        kind: 'large_buy',
        label: 'BUY',
        color: '#16A34A',
        position: 'belowBar',
        shape: 'arrowUp',
      }
    case 'large_sell':
      return {
        time: t,
        kind: 'large_sell',
        label: 'SELL',
        color: '#DC2626',
        position: 'aboveBar',
        shape: 'arrowDown',
      }
    case 'risk_score_change':
      return {
        time: t,
        kind: 'risk',
        label: 'RISK',
        color: '#D97706',
        position: 'aboveBar',
        shape: 'square',
      }
    default:
      return null
  }
}

function structureToMark(l: StructureLabel): ChartEventMark {
  const bosLike = l.kind === 'BOS' || l.kind === 'CHOCH'
  const bull = l.bias === 'bullish'
  return {
    time: l.time,
    kind: 'structure',
    label: l.text,
    color: bosLike ? (bull ? '#16A34A' : '#DC2626') : '#6B7280',
    position: bull || l.kind === 'HH' || l.kind === 'LH' ? 'aboveBar' : 'belowBar',
    shape: bosLike ? (bull ? 'arrowUp' : 'arrowDown') : 'circle',
  }
}

function buildZones(args: {
  candles: Candle[]
  structure: MarketStructureResult
  mint: string
  mode: TerminalDataMode
}): ChartPriceZone[] {
  const { candles, structure, mint, mode } = args
  if (!candles.length) return []
  const last = candles[candles.length - 1]!
  const zones: ChartPriceZone[] = []

  if (structure.lastSwingHigh) {
    zones.push({
      id: 'liq-high',
      price: structure.lastSwingHigh.price,
      title: 'Liquidity · high',
      color: 'rgba(37,99,235,0.75)',
      lineStyle: 'dashed',
      lineWidth: 1,
    })
  }
  if (structure.lastSwingLow) {
    zones.push({
      id: 'liq-low',
      price: structure.lastSwingLow.price,
      title: 'Liquidity · low',
      color: 'rgba(37,99,235,0.75)',
      lineStyle: 'dashed',
      lineWidth: 1,
    })
  }

  // Conviction zone — mid-range band around last price when opportunity engine has SM inflow
  if (mode === 'demo') {
    const measured = getDemoOpportunityInputs().find((m) => m.mint === mint)
    const snap = getTerminalSnapshot('demo')
    const coach = snap.coach.status === 'ready' ? snap.coach.data : null
    const conviction =
      coach?.recommended?.mint === mint
        ? coach.recommended.convictionScore
        : measured
          ? Math.min(100, Math.round(50 + measured.smartMoneyNetInflowUsd / 5000))
          : null

    if (conviction != null && conviction >= 60) {
      const pad = last.close * 0.012
      zones.push({
        id: 'conviction',
        price: last.close,
        title: `AI conviction ${conviction}`,
        color: 'rgba(37,99,235,0.85)',
        lineStyle: 'solid',
        lineWidth: 2,
      })
      zones.push({
        id: 'conviction-band',
        price: last.close - pad,
        title: 'Conviction zone',
        color: 'rgba(22,163,74,0.4)',
        lineStyle: 'dotted',
        lineWidth: 1,
        axisLabelVisible: false,
      })
    }

    const riskScore =
      coach?.recommended?.mint === mint
        ? coach.recommended.riskScore
        : measured?.riskScore ?? null
    if (riskScore != null && riskScore >= 55) {
      zones.push({
        id: 'risk',
        price: structure.lastSwingLow?.price ?? last.low * 0.98,
        title: `Risk ${riskScore}`,
        color: 'rgba(220,38,38,0.8)',
        lineStyle: 'dashed',
        lineWidth: 2,
      })
    } else if (structure.bias === 'bearish' && structure.lastSwingHigh) {
      zones.push({
        id: 'risk-struct',
        price: structure.lastSwingHigh.price,
        title: 'Risk · structure',
        color: 'rgba(217,119,6,0.7)',
        lineStyle: 'dotted',
        lineWidth: 1,
      })
    }
  } else if (structure.bias === 'bearish' && structure.lastSwingHigh) {
    zones.push({
      id: 'risk-struct',
      price: structure.lastSwingHigh.price,
      title: 'Risk · structure',
      color: 'rgba(217,119,6,0.7)',
      lineStyle: 'dotted',
      lineWidth: 1,
    })
  }

  return zones
}

export function buildChartOverlays(input: {
  candles: Candle[]
  mint: string
  mode: TerminalDataMode
  tradeMarks?: Array<{ time: number; side: 'buy' | 'sell'; label?: string }>
}): ChartOverlayBundle {
  const { candles, mint, mode, tradeMarks = [] } = input
  const structure = detectMarketStructure(candles)
  const times = candles.map((c) => c.time)
  const events: ChartEventMark[] = []

  for (const l of structure.labels) {
    events.push(structureToMark(l))
  }

  if (mode === 'demo') {
    const snap = getTerminalSnapshot('demo')
    if (snap.intel.status === 'ready') {
      for (const e of snap.intel.data) {
        if (e.mint !== mint) continue
        const m = intelToMark(e, times)
        if (m) events.push(m)
      }
    }
  }

  for (const t of tradeMarks) {
    events.push({
      time: nearestTime(times, Math.floor(t.time)),
      kind: t.side === 'buy' ? 'trade_buy' : 'trade_sell',
      label: t.label ?? (t.side === 'buy' ? 'B' : 'S'),
      color: t.side === 'buy' ? '#16A34A' : '#DC2626',
      position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
      shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
    })
  }

  // Dedupe by time+label (keep last)
  const dedup = new Map<string, ChartEventMark>()
  for (const e of events) {
    dedup.set(`${e.time}:${e.label}:${e.kind}`, e)
  }

  const zones = buildZones({ candles, structure, mint, mode })

  return {
    events: [...dedup.values()].sort((a, b) => a.time - b.time),
    zones,
    structure,
    methodNote:
      mode === 'demo'
        ? `${structure.method} · demo intel overlays`
        : `${structure.method} · live events pending feed`,
  }
}
