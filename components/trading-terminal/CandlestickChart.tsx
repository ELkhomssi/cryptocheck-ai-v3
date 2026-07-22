'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type SeriesMarker,
  type Time,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts'
import type { Candle } from '@/lib/trading-terminal/ohlcv-feed'

export type ChartTradeMark = {
  time: number
  side: 'buy' | 'sell'
  label?: string
}

type Props = {
  candles: Candle[]
  marks?: ChartTradeMark[]
  className?: string
}

/**
 * Institutional chart theme — TradingView-grade clarity.
 * Deep black canvas, crisp candles, professional crosshair, volume underlay.
 */
export function CandlestickChart({ candles, marks = [], className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: '#05070A' },
        textColor: '#6B7585',
        fontSize: 11,
        fontFamily: "var(--font-mono-terminal), 'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)', style: LineStyle.Solid },
        horzLines: { color: 'rgba(255,255,255,0.035)', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0,212,255,0.45)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#111927',
        },
        horzLine: {
          color: 'rgba(0,212,255,0.45)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#111927',
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.04, bottom: 0.2 },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        minBarSpacing: 4,
      },
      handleScroll: { vertTouchDrag: false },
      width: el.clientWidth,
      height: el.clientHeight || 240,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00E676',
      downColor: '#FF5252',
      borderUpColor: '#00E676',
      borderDownColor: '#FF5252',
      wickUpColor: '#00C853',
      wickDownColor: '#E53935',
      borderVisible: true,
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
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
      vs.push({
        time: t as HistogramData['time'],
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0,230,118,0.28)' : 'rgba(255,82,82,0.28)',
      })
    }

    candleSeriesRef.current.setData(cs)
    volumeSeriesRef.current.setData(vs)

    if (marks.length > 0 && cs.length > 0) {
      const times = cs.map((c) => Number(c.time))
      const nearest = (t: number) => {
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
      const markers: SeriesMarker<Time>[] = marks.map((m) => {
        const buy = m.side === 'buy'
        return {
          time: nearest(Math.floor(m.time)) as Time,
          position: buy ? 'belowBar' : 'aboveBar',
          color: buy ? '#00E676' : '#FF5252',
          shape: buy ? 'arrowUp' : 'arrowDown',
          text: m.label ?? (buy ? 'B' : 'S'),
        }
      })
      candleSeriesRef.current.setMarkers(markers)
    } else {
      candleSeriesRef.current.setMarkers([])
    }

    chartRef.current?.timeScale().fitContent()
  }, [candles, marks])

  return <div ref={hostRef} className={`min-h-0 w-full flex-1 ${className}`} />
}
