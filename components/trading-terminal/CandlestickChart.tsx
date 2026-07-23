'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type HistogramData,
  type SeriesMarker,
  type Time,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts'
import type { Candle } from '@/lib/trading-terminal/ohlcv-feed'
import type { ChartEventMark, ChartPriceZone } from '@/lib/trading-terminal/chart-overlays'

export type ChartTradeMark = {
  time: number
  side: 'buy' | 'sell'
  label?: string
}

export type CrosshairOhlc = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
} | null

type Props = {
  candles: Candle[]
  /** @deprecated prefer eventMarks from overlay builder */
  marks?: ChartTradeMark[]
  eventMarks?: ChartEventMark[]
  zones?: ChartPriceZone[]
  onCrosshair?: (bar: CrosshairOhlc) => void
  className?: string
}

function toLineStyle(s?: ChartPriceZone['lineStyle']): LineStyle {
  if (s === 'dotted') return LineStyle.Dotted
  if (s === 'dashed') return LineStyle.Dashed
  return LineStyle.Solid
}

/**
 * Institutional primary chart — TradingView-grade candles, volume, overlays.
 */
export function CandlestickChart({
  candles,
  marks = [],
  eventMarks,
  zones = [],
  onCrosshair,
  className = '',
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const candlesRef = useRef(candles)
  const onCrosshairRef = useRef(onCrosshair)
  candlesRef.current = candles
  onCrosshairRef.current = onCrosshair

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: '#05070B' },
        textColor: '#7C8796',
        fontSize: 11,
        fontFamily:
          "var(--font-mono-terminal), 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)', style: LineStyle.Solid },
        horzLines: { color: 'rgba(255,255,255,0.035)', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(59,130,246,0.42)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#111823',
        },
        horzLine: {
          color: 'rgba(59,130,246,0.42)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#111823',
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.18 },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 14,
        minBarSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      kineticScroll: {
        mouse: true,
        touch: true,
      },
      width: el.clientWidth,
      height: el.clientHeight || 520,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#16A34A',
      wickDownColor: '#DC2626',
      borderVisible: true,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineWidth: 1,
      priceLineColor: 'rgba(59,130,246,0.4)',
      priceLineStyle: LineStyle.SparseDotted,
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chart.subscribeCrosshairMove((param) => {
      const cb = onCrosshairRef.current
      if (!cb) return
      if (!param.time || !param.seriesData.size) {
        cb(null)
        return
      }
      const raw = param.seriesData.get(candleSeries) as
        | { open?: number; high?: number; low?: number; close?: number; time?: Time }
        | undefined
      if (!raw || raw.open == null || raw.close == null) {
        cb(null)
        return
      }
      const t = Math.floor(Number(param.time))
      const match = candlesRef.current.find((c) => Math.floor(c.time) === t)
      cb({
        time: t,
        open: raw.open,
        high: raw.high ?? raw.open,
        low: raw.low ?? raw.open,
        close: raw.close,
        volume: match?.volume ?? 0,
      })
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return
      chartRef.current.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight,
      })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      for (const pl of priceLinesRef.current) {
        try {
          candleSeries.removePriceLine(pl)
        } catch {
          /* chart may already be disposed */
        }
      }
      priceLinesRef.current = []
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles.length) return

    const seen = new Set<number>()
    const cs: CandlestickData[] = []
    const vs: HistogramData[] = []

    for (const c of candles) {
      const t = Math.floor(c.time)
      if (seen.has(t)) continue
      seen.add(t)
      cs.push({
        time: t as CandlestickData['time'],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })
      const up = c.close >= c.open
      vs.push({
        time: t as HistogramData['time'],
        value: c.volume,
        color: up ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
      })
    }

    candleSeriesRef.current.setData(cs)
    volumeSeriesRef.current.setData(vs)

    const markers: SeriesMarker<Time>[] = []
    const times = cs.map((c) => Number(c.time))
    const nearest = (t: number) => {
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

    if (eventMarks?.length) {
      for (const m of eventMarks) {
        markers.push({
          time: nearest(Math.floor(m.time)) as Time,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.label,
        })
      }
    } else if (marks.length > 0) {
      for (const m of marks) {
        const buy = m.side === 'buy'
        markers.push({
          time: nearest(Math.floor(m.time)) as Time,
          position: buy ? 'belowBar' : 'aboveBar',
          color: buy ? '#22C55E' : '#EF4444',
          shape: buy ? 'arrowUp' : 'arrowDown',
          text: m.label ?? (buy ? 'B' : 'S'),
        })
      }
    }

    markers.sort((a, b) => Number(a.time) - Number(b.time))
    candleSeriesRef.current.setMarkers(markers)

    for (const pl of priceLinesRef.current) {
      try {
        candleSeriesRef.current.removePriceLine(pl)
      } catch {
        /* ignore */
      }
    }
    priceLinesRef.current = []
    for (const z of zones) {
      const pl = candleSeriesRef.current.createPriceLine({
        price: z.price,
        color: z.color,
        lineWidth: z.lineWidth ?? 1,
        lineStyle: toLineStyle(z.lineStyle),
        axisLabelVisible: z.axisLabelVisible !== false,
        title: z.title,
      })
      priceLinesRef.current.push(pl)
    }

    chartRef.current?.timeScale().fitContent()
  }, [candles, marks, eventMarks, zones])

  return <div ref={hostRef} className={`min-h-0 w-full flex-1 ${className}`} />
}
