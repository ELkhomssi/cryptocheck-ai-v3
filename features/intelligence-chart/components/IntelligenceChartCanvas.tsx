'use client'

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts'
import type { AiZoneBand, IntelligenceChartBundle, LayerId } from '../types'
import { clusterEvents, eventsForCanvas, markerOpacityForLayerCount } from '../composition'

function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(4)
}

export function IntelligenceChartCanvas({
  bundle,
  visibility,
  playhead,
  highlightEventId,
  onCrosshairTime,
}: {
  bundle: IntelligenceChartBundle
  visibility: Partial<Record<LayerId, boolean>>
  playhead: number | null
  highlightEventId: string | null
  onCrosshairTime: (ts: number | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [ohlc, setOhlc] = useState<{ o: number; h: number; l: number; c: number } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [clusters, setClusters] = useState<
    ReturnType<typeof clusterEvents>
  >([])

  const markerEvents = useMemo(() => {
    const all = bundle.layers.flatMap((l) => l.events)
    return eventsForCanvas(all, visibility)
  }, [bundle.layers, visibility])

  const enabledOverlays = useMemo(
    () =>
      (['liquidity', 'holders', 'developer', 'ai', 'security', 'narrative'] as LayerId[]).filter(
        (id) => visibility[id],
      ).length,
    [visibility],
  )

  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const chart = createChart(el, {
      height: el.clientHeight || 360,
      width: el.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8a8678',
        fontSize: 10,
        fontFamily: 'var(--tos-mono, ui-monospace, monospace)',
      },
      grid: {
        vertLines: { color: 'rgba(40,38,32,0.9)' },
        horzLines: { color: 'rgba(40,38,32,0.9)' },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(212,175,55,0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(212,175,55,0.4)', width: 1, style: 2 },
      },
    })
    const candles = chart.addCandlestickSeries({
      upColor: '#16c784',
      downColor: '#ea3943',
      borderVisible: false,
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
    })
    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    })

    chartRef.current = chart
    candleRef.current = candles
    volRef.current = volume

    const onMove = (param: MouseEventParams) => {
      if (!param.time || !param.seriesData) {
        setOhlc(null)
        onCrosshairTime(null)
        return
      }
      const t = param.time as number
      onCrosshairTime(typeof t === 'number' ? t : null)
      const bar = param.seriesData.get(candles) as CandlestickData | undefined
      if (bar && typeof bar.open === 'number') {
        setOhlc({ o: bar.open, h: bar.high, l: bar.low, c: bar.close })
      }
    }
    chart.subscribeCrosshairMove(onMove)

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const h = el.clientHeight
      chart.applyOptions({ width: w, height: h })
      setSize({ w, h })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })

    return () => {
      ro.disconnect()
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volRef.current = null
    }
  }, [onCrosshairTime])

  useEffect(() => {
    if (!candleRef.current || !volRef.current) return
    const data: CandlestickData[] = bundle.candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    const vols: HistogramData[] = bundle.candles.map((c) => ({
      time: c.time as Time,
      value: c.volume ?? Math.abs(c.close - c.open) * 1000,
      color: c.close >= c.open ? 'rgba(22,199,132,0.4)' : 'rgba(234,57,67,0.4)',
    }))
    candleRef.current.setData(data)
    volRef.current.setData(vols)
    chartRef.current?.timeScale().fitContent()
  }, [bundle.candles])

  // Reproject clusters when events / size / zoom may change
  useEffect(() => {
    const chart = chartRef.current
    const series = candleRef.current
    if (!chart || !series || !size.w) {
      setClusters([])
      return
    }
    const ts = chart.timeScale()
    const clustered = clusterEvents(markerEvents, (ev) => {
      const x = ts.timeToCoordinate(ev.timestamp as Time)
      const y = series.priceToCoordinate(ev.price)
      if (x == null || y == null) return null
      return { xPx: x, yPx: y }
    })
    setClusters(clustered)

    const onRange = () => {
      const next = clusterEvents(markerEvents, (ev) => {
        const x = ts.timeToCoordinate(ev.timestamp as Time)
        const y = series.priceToCoordinate(ev.price)
        if (x == null || y == null) return null
        return { xPx: x, yPx: y }
      })
      setClusters(next)
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
    }
  }, [markerEvents, size, bundle.candles])

  useEffect(() => {
    if (playhead == null || !chartRef.current) return
    chartRef.current.timeScale().scrollToPosition(0, false)
    // Jump viewport near playhead via setVisibleRange if possible
    const candles = bundle.candles
    if (!candles.length) return
    const idx = candles.findIndex((c) => c.time >= playhead)
    const i = idx < 0 ? candles.length - 1 : idx
    const from = candles[Math.max(0, i - 40)]!.time
    const to = candles[Math.min(candles.length - 1, i + 10)]!.time
    try {
      chartRef.current.timeScale().setVisibleRange({ from: from as Time, to: to as Time })
    } catch {
      /* ignore range errors */
    }
  }, [playhead, bundle.candles])

  const zones = visibility.ai ? bundle.aiZones : []
  const showRibbon = visibility.liquidity && bundle.liquidityRibbon.length > 0

  return (
    <div className="ic-canvas-wrap">
      {ohlc ? (
        <div className="ic-ohlc">
          <span>O {fmtPx(ohlc.o)}</span>
          <span>H {fmtPx(ohlc.h)}</span>
          <span>L {fmtPx(ohlc.l)}</span>
          <span className={ohlc.c >= ohlc.o ? 'tos-pos' : 'tos-neg'}>C {fmtPx(ohlc.c)}</span>
        </div>
      ) : null}

      {/* AI zones — background shading behind markers */}
      <div className="ic-zone-layer" aria-hidden>
        {zones.map((z) => (
          <ZoneBand key={z.id} zone={z} chartRef={chartRef} candleRef={candleRef} />
        ))}
      </div>

      <div ref={wrapRef} className="ic-canvas" />

      {/* Marker overlay (clustered) */}
      <div className="ic-marker-layer" aria-hidden>
        {clusters.map((c) => {
          const opacity = markerOpacityForLayerCount(
            enabledOverlays,
            c.severity,
            c.primaryLayer,
          )
          const highlighted = c.events.some((e) => e.id === highlightEventId)
          return (
            <div
              key={c.id}
              className="ic-marker"
              data-severity={c.severity}
              data-layer={c.primaryLayer}
              data-highlight={highlighted}
              style={{
                left: c.xPx,
                top: c.yPx,
                opacity,
              }}
              title={c.events.map((e) => e.label).join(' · ')}
            >
              {c.count > 1 ? <span className="ic-marker-count">+{c.count}</span> : null}
            </div>
          )
        })}
      </div>

      {showRibbon ? (
        <div className="ic-liq-ribbon" title="Liquidity depth (Market Intelligence)">
          Liq {fmtUsd(bundle.token.liquidityUsd)}
        </div>
      ) : null}

      {visibility.ai && bundle.aiStrip.length ? (
        <AiStrip strip={bundle.aiStrip} />
      ) : null}
    </div>
  )
}

function ZoneBand({
  zone,
  chartRef,
  candleRef,
}: {
  zone: AiZoneBand
  chartRef: MutableRefObject<IChartApi | null>
  candleRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  )

  useEffect(() => {
    const chart = chartRef.current
    const series = candleRef.current
    if (!chart || !series) return
    const update = () => {
      const x1 = chart.timeScale().timeToCoordinate(zone.timeFrom as Time)
      const x2 = chart.timeScale().timeToCoordinate(zone.timeTo as Time)
      const y1 = series.priceToCoordinate(zone.priceHigh)
      const y2 = series.priceToCoordinate(zone.priceLow)
      if (x1 == null || x2 == null || y1 == null || y2 == null) {
        setBox(null)
        return
      }
      setBox({
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.max(4, Math.abs(y2 - y1)),
      })
    }
    update()
    chart.timeScale().subscribeVisibleLogicalRangeChange(update)
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(update)
  }, [zone, chartRef, candleRef])

  if (!box) return null
  return (
    <div
      className={`ic-zone ic-zone-${zone.kind}`}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      title={zone.label}
    />
  )
}

function AiStrip({
  strip,
}: {
  strip: IntelligenceChartBundle['aiStrip']
}) {
  const last = strip[strip.length - 1]!
  return (
    <div className="ic-ai-strip" aria-label="AI indicator strip">
      <span>Conf {last.confidence}</span>
      <span>Conv {last.conviction}</span>
      <span>Risk {last.risk}</span>
      <span>Trend {Math.round(last.trend)}</span>
    </div>
  )
}

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}
