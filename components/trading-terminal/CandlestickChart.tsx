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
} from 'lightweight-charts'
import type { Candle } from '@/lib/trading-terminal/ohlcv-feed'

export type ChartTradeMark = {
  time: number // unix seconds
  side: 'buy' | 'sell'
  label?: string
}

type Props = {
  candles: Candle[]
  marks?: ChartTradeMark[]
  className?: string
}

/**
 * Institutional candlestick + volume — TradingView lightweight-charts.
 * Optional trade markers from DEMO_SEED / local trade log (never invented).
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
        background: { type: ColorType.Solid, color: '#0C1017' },
        textColor: '#5B6675',
        fontSize: 10,
        fontFamily: "var(--font-mono-terminal), 'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: '#1E2633' },
        horzLines: { color: '#1E2633' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#2A3646', labelBackgroundColor: '#1A2233' },
        horzLine: { color: '#2A3646', labelBackgroundColor: '#1A2233' },
      },
      rightPriceScale: {
        borderColor: '#1E2633',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: '#1E2633',
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth,
      height: el.clientHeight || 200,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
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
        color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
      })
    }

    candleSeriesRef.current.setData(cs)
    volumeSeriesRef.current.setData(vs)

    // Snap marks onto nearest candle time so lightweight-charts accepts them
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
          color: buy ? '#22C55E' : '#EF4444',
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
