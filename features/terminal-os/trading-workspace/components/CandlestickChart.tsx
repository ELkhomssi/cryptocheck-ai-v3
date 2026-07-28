'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  ColorType,
} from 'lightweight-charts'
import type { CandleBar } from '@/features/terminal-os/shared/types'

/** Professional TV Lightweight Charts — candles + volume histogram */
export function CandlestickChart({
  candles,
  height = 180,
}: {
  candles: CandleBar[]
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b93a7',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(31,37,54,0.85)' },
        horzLines: { color: 'rgba(31,37,54,0.85)' },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(240,185,11,0.35)', width: 1, style: 2 },
        horzLine: { color: 'rgba(240,185,11,0.35)', width: 1, style: 2 },
      },
      width: ref.current.clientWidth,
    })

    const candlesSeries = chart.addCandlestickSeries({
      upColor: '#16c784',
      downColor: '#ea3943',
      borderVisible: false,
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
    })
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    })

    chartRef.current = chart
    candleRef.current = candlesSeries
    volRef.current = volumeSeries

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth })
    })
    ro.observe(ref.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volRef.current = null
    }
  }, [height])

  useEffect(() => {
    if (!candleRef.current || !volRef.current) return
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as CandlestickData['time'],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    const vols: HistogramData[] = candles.map((c) => ({
      time: c.time as HistogramData['time'],
      value: c.volume ?? Math.abs(c.close - c.open) * 1000,
      color:
        c.close >= c.open ? 'rgba(22,199,132,0.45)' : 'rgba(234,57,67,0.45)',
    }))
    candleRef.current.setData(data)
    volRef.current.setData(vols)
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  if (!candles.length) {
    return <div className="tos-skeleton" style={{ height, width: '100%' }} aria-label="Chart loading" />
  }

  return <div ref={ref} className="tos-chart-canvas" style={{ width: '100%', height }} />
}
