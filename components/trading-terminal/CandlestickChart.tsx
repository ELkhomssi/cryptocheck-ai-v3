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
 * PROMPT 25 — Institutional chart theme (Bloomberg calm, not neon retail).
 * Desaturated candles, hairline grid, subtle volume.
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
        fontSize: 9,
        fontFamily: "var(--font-mono-terminal), 'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(30,38,51,0.45)' },
        horzLines: { color: 'rgba(30,38,51,0.45)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(42,54,70,0.8)',
          width: 1,
          labelBackgroundColor: '#1A2233',
        },
        horzLine: {
          color: 'rgba(42,54,70,0.8)',
          width: 1,
          labelBackgroundColor: '#1A2233',
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.18 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
      width: el.clientWidth,
      height: el.clientHeight || 200,
    })

    // Desaturated ~15% vs neon retail greens/reds
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#1FA855',
      downColor: '#D63B3B',
      borderUpColor: '#1FA855',
      borderDownColor: '#D63B3B',
      wickUpColor: '#1A8F48',
      wickDownColor: '#B83232',
      borderVisible: false,
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.86, bottom: 0 },
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
        color: c.close >= c.open ? 'rgba(31,168,85,0.22)' : 'rgba(214,59,59,0.22)',
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
          color: buy ? '#1FA855' : '#D63B3B',
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
