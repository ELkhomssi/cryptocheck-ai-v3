'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type MouseEventParams,
  ColorType,
} from 'lightweight-charts'
import type { CandleBar } from '@/features/terminal-os/shared/types'

function toCandle(c: CandleBar): CandlestickData {
  return {
    time: c.time as CandlestickData['time'],
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }
}

function toVol(c: CandleBar): HistogramData {
  return {
    time: c.time as HistogramData['time'],
    value: c.volume ?? Math.abs(c.close - c.open) * 1000,
    color: c.close >= c.open ? 'rgba(22,199,132,0.45)' : 'rgba(234,57,67,0.45)',
  }
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(4)
}

/**
 * TradingView Lightweight Charts (MIT) — canvas candlesticks + volume.
 * Same CandleBar[] contract as before; no iframe / no TV branding.
 */
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
  const prevLenRef = useRef(0)
  const prevLastTimeRef = useRef<number | null>(null)
  const [ohlc, setOhlc] = useState<{
    o: number
    h: number
    l: number
    c: number
  } | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b93a7',
        fontSize: 10,
        fontFamily: 'var(--tos-mono, ui-monospace, monospace)',
      },
      grid: {
        vertLines: { color: 'rgba(31,37,54,0.85)' },
        horzLines: { color: 'rgba(31,37,54,0.85)' },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(212,175,55,0.35)', width: 1, style: 2 },
        horzLine: { color: 'rgba(212,175,55,0.35)', width: 1, style: 2 },
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

    const onMove = (param: MouseEventParams) => {
      if (!param.time || !param.seriesData) {
        setOhlc(null)
        return
      }
      const bar = param.seriesData.get(candlesSeries) as CandlestickData | undefined
      if (!bar || typeof bar.open !== 'number') {
        setOhlc(null)
        return
      }
      setOhlc({ o: bar.open, h: bar.high, l: bar.low, c: bar.close })
    }
    chart.subscribeCrosshairMove(onMove)

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth })
    })
    ro.observe(ref.current)

    return () => {
      ro.disconnect()
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volRef.current = null
      prevLenRef.current = 0
      prevLastTimeRef.current = null
    }
  }, [height])

  useEffect(() => {
    if (!candleRef.current || !volRef.current) return
    if (!candles.length) {
      candleRef.current.setData([])
      volRef.current.setData([])
      prevLenRef.current = 0
      prevLastTimeRef.current = null
      return
    }

    const last = candles[candles.length - 1]!
    const prevLen = prevLenRef.current
    const prevLastTime = prevLastTimeRef.current
    const canIncremental =
      prevLen > 0 &&
      (candles.length === prevLen || candles.length === prevLen + 1) &&
      prevLastTime != null &&
      (last.time === prevLastTime || (candles.length === prevLen + 1 && candles[prevLen - 1]?.time === prevLastTime))

    if (canIncremental) {
      // Live tick / new bar — native update, no full series redraw
      candleRef.current.update(toCandle(last))
      volRef.current.update(toVol(last))
    } else {
      candleRef.current.setData(candles.map(toCandle))
      volRef.current.setData(candles.map(toVol))
      chartRef.current?.timeScale().fitContent()
    }

    prevLenRef.current = candles.length
    prevLastTimeRef.current = last.time
  }, [candles])

  if (!candles.length) {
    return <div className="tos-skeleton" style={{ height, width: '100%' }} aria-label="Chart loading" />
  }

  return (
    <div className="tos-chart-wrap" style={{ height, width: '100%' }}>
      {ohlc ? (
        <div className="tos-chart-ohlc tos-num" aria-live="polite">
          <span>O {fmtPx(ohlc.o)}</span>
          <span>H {fmtPx(ohlc.h)}</span>
          <span>L {fmtPx(ohlc.l)}</span>
          <span className={ohlc.c >= ohlc.o ? 'tos-pos' : 'tos-neg'}>C {fmtPx(ohlc.c)}</span>
        </div>
      ) : null}
      <div ref={ref} className="tos-chart-canvas" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
