'use client'

/**
 * CryptoCheckAI Intelligence Visualization System — canvas renderer.
 * Raw echarts.init (no wrapper). Interaction mechanics stay standard (zoom/pan/crosshair).
 * Intelligence expression (color, AI strip, markers, zones) is proprietary.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { EChartsType } from 'echarts'
import type { IntelligenceChartBundle, LayerId } from '../types'
import {
  clusterEvents,
  eventsForCanvas,
  markerOpacityForLayerCount,
} from '../composition'
import {
  IV,
  colorForLayer,
  colorForSeverity,
  colorForConviction,
  colorForRiskScore,
} from '../visual-tokens'

function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(4)
}

function toMs(sec: number): number {
  return sec < 1e12 ? sec * 1000 : sec
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
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const onCrosshairRef = useRef(onCrosshairTime)
  onCrosshairRef.current = onCrosshairTime

  const [ohlc, setOhlc] = useState<{ o: number; h: number; l: number; c: number } | null>(null)
  const [noticed, setNoticed] = useState(false)

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

  const showAiStrip = Boolean(visibility.ai && bundle.aiStrip.length)
  const showLiq = Boolean(visibility.liquidity && bundle.liquidityRibbon.length)
  const showHolders = Boolean(visibility.holders && bundle.holderSeries.length)

  // Signature motion: "system just noticed" when AI / playhead / highlight updates
  useEffect(() => {
    setNoticed(true)
    const t = window.setTimeout(() => setNoticed(false), 900)
    return () => window.clearTimeout(t)
  }, [bundle.fetchedAt, playhead, highlightEventId, bundle.aiStrip.length])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    chartRef.current = chart

    const onUpdate = (params: unknown) => {
      const p = params as { axesInfo?: Array<{ value?: number | string }> }
      const axis = p.axesInfo?.[0]
      if (!axis || axis.value == null) {
        setOhlc(null)
        onCrosshairRef.current(null)
        return
      }
      const ms = typeof axis.value === 'number' ? axis.value : Date.parse(String(axis.value))
      if (!Number.isFinite(ms)) {
        onCrosshairRef.current(null)
        return
      }
      const sec = Math.floor(ms / 1000)
      onCrosshairRef.current(sec)
      const candles = candlesRef.current
      let best: (typeof candles)[number] | null = null
      for (const c of candles) {
        if (c.time > sec) break
        best = c
      }
      if (best) setOhlc({ o: best.open, h: best.high, l: best.low, c: best.close })
    }
    chart.on('updateAxisPointer', onUpdate)

    const ro = new ResizeObserver(() => {
      chart.resize()
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.off('updateAxisPointer', onUpdate)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  const candlesRef = useRef(bundle.candles)
  candlesRef.current = bundle.candles

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const candleData = bundle.candles.map((c) => [
      toMs(c.time),
      c.open,
      c.close,
      c.low,
      c.high,
    ])
    const volumeData = bundle.candles.map((c) => [
      toMs(c.time),
      c.volume ?? Math.abs(c.close - c.open) * 1000,
    ])

    const grids = showAiStrip
      ? [
          { left: 48, right: 56, top: 28, height: '52%' },
          { left: 48, right: 56, top: '64%', height: '12%' },
          { left: 48, right: 56, top: '80%', height: '12%' },
        ]
      : [
          { left: 48, right: 56, top: 28, height: '62%' },
          { left: 48, right: 56, top: '78%', height: '14%' },
        ]

    const xAxes = grids.map((_, i) => ({
      type: 'time' as const,
      gridIndex: i,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: i === grids.length - 1,
        color: IV.axisText,
        fontSize: 10,
        fontFamily: 'var(--tos-mono, ui-monospace, monospace)',
      },
      splitLine: { show: false },
    }))

    const yAxes: echarts.YAXisComponentOption[] = [
      {
        type: 'value',
        gridIndex: 0,
        scale: true,
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: IV.axisText,
          fontSize: 10,
          fontFamily: 'var(--tos-mono, ui-monospace, monospace)',
          formatter: (v: number) => fmtPx(v),
        },
        splitLine: { lineStyle: { color: IV.gridLine } },
      },
      {
        type: 'value',
        gridIndex: 1,
        scale: true,
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ]
    if (showAiStrip) {
      yAxes.push({
        type: 'value',
        gridIndex: 2,
        min: 0,
        max: 100,
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      })
    }

    const markAreaData =
      visibility.ai && bundle.aiZones.length
        ? bundle.aiZones.map((z) => [
            {
              xAxis: toMs(z.timeFrom),
              yAxis: z.priceLow,
              itemStyle: {
                color: z.kind === 'buy' ? IV.zoneBuy : IV.zoneSell,
                borderColor: z.kind === 'buy' ? IV.zoneBuyBorder : IV.zoneSellBorder,
              },
            },
            {
              xAxis: toMs(z.timeTo),
              yAxis: z.priceHigh,
            },
          ])
        : []

    let markPoints: NonNullable<echarts.MarkPointComponentOption['data']> = []
    try {
      const clustered = clusterEvents(markerEvents, (ev) => {
        const pt = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
          toMs(ev.timestamp),
          ev.price,
        ])
        if (!pt || !Array.isArray(pt)) return null
        const [xPx, yPx] = pt as number[]
        if (!Number.isFinite(xPx) || !Number.isFinite(yPx)) return null
        return { xPx, yPx }
      })
      markPoints = clustered.map((c) => {
        const opacity = markerOpacityForLayerCount(
          enabledOverlays,
          c.severity,
          c.primaryLayer,
        )
        const highlighted = c.events.some((e) => e.id === highlightEventId)
        const color =
          c.primaryLayer === 'security' || c.severity === 'critical'
            ? colorForSeverity(c.severity)
            : colorForLayer(c.primaryLayer)
        return {
          name: c.events.map((e) => e.label).join(' · '),
          coord: [toMs(c.timestamp), c.price],
          value: c.count > 1 ? c.count : undefined,
          symbol: 'circle',
          symbolSize: highlighted ? 12 : c.severity === 'critical' ? 10 : 7,
          itemStyle: {
            color,
            opacity,
            borderColor: highlighted ? IV.convictionHigh : '#000',
            borderWidth: highlighted ? 2 : 1,
          },
          label: {
            show: c.count > 1,
            formatter: `+${c.count}`,
            color: IV.axisText,
            fontSize: 9,
            position: 'top',
          },
        }
      })
    } catch {
      markPoints = markerEvents.map((ev) => ({
        name: ev.label,
        coord: [toMs(ev.timestamp), ev.price],
        symbolSize: 7,
        itemStyle: { color: colorForLayer(ev.layerId) },
      }))
    }

    const series: echarts.SeriesOption[] = [
      {
        id: 'candles',
        type: 'candlestick',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: candleData,
        itemStyle: {
          color: IV.priceUp,
          color0: IV.priceDown,
          borderColor: IV.priceUp,
          borderColor0: IV.priceDown,
        },
        markArea: markAreaData.length
          ? {
              silent: true,
              data: markAreaData as unknown as echarts.MarkAreaComponentOption['data'],
            }
          : undefined,
        markPoint: markPoints.length ? { data: markPoints, animation: false } : undefined,
        markLine:
          playhead != null
            ? {
                symbol: 'none',
                label: { show: false },
                lineStyle: { color: IV.convictionHigh, width: 1, type: 'dashed' },
                data: [{ xAxis: toMs(playhead) }],
              }
            : undefined,
        z: 2,
      },
      {
        id: 'volume',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeData.map((row, i) => {
          const c = bundle.candles[i]!
          return {
            value: row,
            itemStyle: {
              color: c.close >= c.open ? 'rgba(22,199,132,0.35)' : 'rgba(234,57,67,0.35)',
            },
          }
        }),
        barWidth: '60%',
        z: 1,
      },
    ]

    if (showLiq) {
      series.push({
        id: 'liquidity',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        showSymbol: false,
        lineStyle: { color: IV.liquidity, width: 1.25, opacity: 0.85 },
        areaStyle: { color: 'rgba(61,139,253,0.08)' },
        data: bundle.liquidityRibbon.map((p) => [toMs(p.time), p.liquidityUsd]),
        z: 3,
      })
    }

    if (showHolders) {
      series.push({
        id: 'holders',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        showSymbol: false,
        lineStyle: { color: IV.holders, width: 1.25, type: 'dotted' },
        data: bundle.holderSeries.map((p) => [toMs(p.time), p.holderCount]),
        z: 4,
      })
    }

    if (showAiStrip) {
      const strip = bundle.aiStrip
      series.push(
        {
          id: 'ai-confidence',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          showSymbol: false,
          lineStyle: { color: IV.convictionHigh, width: 1.5 },
          data: strip.map((p) => [toMs(p.time), p.confidence]),
          z: 5,
        },
        {
          id: 'ai-conviction',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          showSymbol: false,
          lineStyle: { color: IV.convictionMid, width: 1.5 },
          data: strip.map((p) => [toMs(p.time), p.conviction]),
          z: 5,
        },
        {
          id: 'ai-risk',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          showSymbol: false,
          lineStyle: { color: IV.riskCritical, width: 1.25 },
          data: strip.map((p) => [toMs(p.time), p.risk]),
          z: 5,
        },
        {
          id: 'ai-trend',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          showSymbol: false,
          lineStyle: { color: IV.liquidity, width: 1, type: 'dashed' },
          data: strip.map((p) => [toMs(p.time), p.trend]),
          z: 5,
        },
      )
    }

    if (visibility.narrative) {
      const narrativeEvents = bundle.layers
        .flatMap((l) => l.events)
        .filter((e) => e.layerId === 'narrative')
      if (narrativeEvents.length) {
        series.push({
          id: 'narrative',
          type: 'scatter',
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbolSize: 1,
          data: narrativeEvents.map((e) => [toMs(e.timestamp), e.price]),
          label: {
            show: true,
            formatter: (p) => {
              const ev = narrativeEvents[p.dataIndex as number]
              return ev?.label ?? ''
            },
            color: IV.narrative,
            fontSize: 10,
            fontWeight: 600,
            backgroundColor: 'rgba(7,7,7,0.85)',
            borderColor: 'rgba(212,175,55,0.35)',
            borderWidth: 1,
            borderRadius: 3,
            padding: [3, 6],
            position: 'top',
          },
          itemStyle: { opacity: 0 },
          z: 8,
        })
      }
    }

    const option: echarts.EChartsOption = {
      animation: false,
      backgroundColor: IV.canvasBg,
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        lineStyle: { color: IV.crosshair, width: 1, type: 'dashed' },
        label: { show: false },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(10,10,10,0.94)',
        borderColor: IV.instrumentEdge,
        textStyle: {
          color: '#f5f5f2',
          fontSize: 11,
          fontFamily: 'var(--tos-mono, ui-monospace, monospace)',
        },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params]
          const candle = list.find((p) => (p as { seriesId?: string }).seriesId === 'candles') as
            | { value?: number[]; axisValueLabel?: string }
            | undefined
          if (!candle?.value) return ''
          const v = candle.value
          return [
            `<div style="font-weight:700;margin-bottom:4px">${candle.axisValueLabel ?? ''}</div>`,
            `O ${fmtPx(Number(v[1]))} · H ${fmtPx(Number(v[4]))} · L ${fmtPx(Number(v[3]))} · C ${fmtPx(Number(v[2]))}`,
          ].join('')
        },
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      dataZoom: [
        { type: 'inside', xAxisIndex: grids.map((_, i) => i), filterMode: 'none' },
        {
          type: 'slider',
          xAxisIndex: grids.map((_, i) => i),
          height: 16,
          bottom: 4,
          borderColor: IV.instrumentEdge,
          fillerColor: 'rgba(212,175,55,0.12)',
          handleStyle: { color: IV.convictionMid },
          textStyle: { color: IV.axisText, fontSize: 9 },
          dataBackground: {
            lineStyle: { color: IV.instrumentEdge },
            areaStyle: { color: 'rgba(212,175,55,0.06)' },
          },
        },
      ],
      series,
    }

    chart.setOption(option, { notMerge: true })

    if (playhead != null && bundle.candles.length) {
      const idx = bundle.candles.findIndex((c) => c.time >= playhead)
      const i = idx < 0 ? bundle.candles.length - 1 : idx
      const from = toMs(bundle.candles[Math.max(0, i - 40)]!.time)
      const to = toMs(bundle.candles[Math.min(bundle.candles.length - 1, i + 10)]!.time)
      chart.dispatchAction({
        type: 'dataZoom',
        startValue: from,
        endValue: to,
      })
    }
  }, [
    bundle,
    visibility,
    playhead,
    highlightEventId,
    markerEvents,
    enabledOverlays,
    showAiStrip,
    showLiq,
    showHolders,
  ])

  const lastStrip = bundle.aiStrip[bundle.aiStrip.length - 1]

  return (
    <div className="ic-canvas-wrap" data-iv-noticed={noticed ? 'true' : 'false'}>
      {ohlc ? (
        <div className="ic-ohlc">
          <span>O {fmtPx(ohlc.o)}</span>
          <span>H {fmtPx(ohlc.h)}</span>
          <span>L {fmtPx(ohlc.l)}</span>
          <span className={ohlc.c >= ohlc.o ? 'tos-pos' : 'tos-neg'}>C {fmtPx(ohlc.c)}</span>
        </div>
      ) : null}

      <div ref={hostRef} className="ic-canvas" />

      {showAiStrip && lastStrip ? (
        <div className="ic-ai-instrument" aria-label="AI instrument strip">
          <div className="ic-ai-instrument-glow" aria-hidden />
          <Metric
            label="Conviction"
            value={Math.round(lastStrip.conviction)}
            color={colorForConviction(lastStrip.conviction)}
          />
          <Metric
            label="Confidence"
            value={Math.round(lastStrip.confidence)}
            color={colorForConviction(lastStrip.confidence)}
          />
          <Metric
            label="Risk"
            value={Math.round(lastStrip.risk)}
            color={colorForRiskScore(lastStrip.risk)}
          />
          <Metric label="Trend" value={Math.round(lastStrip.trend)} color={IV.liquidity} />
        </div>
      ) : null}
    </div>
  )
}

function Metric({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="ic-ai-metric">
      <span className="ic-ai-metric-label">{label}</span>
      <span className="ic-ai-metric-value" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
