'use client'

/**
 * Pure execution chart — candlesticks + volume only.
 * Reuses Intelligence Chart price feed (useIntelligenceChart). No intel overlays.
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsType } from 'echarts'
import { useIntelligenceChart } from '@/features/intelligence-chart/hooks/useIntelligenceChart'
import { PanelSkeleton, EmptyState } from '@/features/terminal-os/shared/components/PanelStates'

function toMs(sec: number): number {
  return sec < 1e12 ? sec * 1000 : sec
}

export function ExecutionTradingChart({
  query,
  chain = 'solana',
}: {
  query: string
  chain?: string
}) {
  const { data: bundle, isLoading, isError } = useIntelligenceChart(query, chain)
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsType | null>(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !bundle?.candles?.length) return
    const candles = bundle.candles
    chart.setOption(
      {
        animation: false,
        backgroundColor: 'transparent',
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(10,10,10,0.94)',
          borderColor: '#1c1c1c',
          textStyle: { color: '#f5f5f2', fontSize: 11 },
        },
        grid: [
          { left: 48, right: 56, top: 24, height: '62%' },
          { left: 48, right: 56, top: '78%', height: '14%' },
        ],
        xAxis: [
          {
            type: 'time',
            gridIndex: 0,
            axisLabel: { show: false },
            axisLine: { show: false },
            splitLine: { show: false },
          },
          {
            type: 'time',
            gridIndex: 1,
            axisLabel: { color: '#8a8678', fontSize: 10 },
            axisLine: { show: false },
            splitLine: { show: false },
          },
        ],
        yAxis: [
          {
            type: 'value',
            gridIndex: 0,
            scale: true,
            position: 'right',
            axisLabel: { color: '#8a8678', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(40,38,32,0.9)' } },
            axisLine: { show: false },
          },
          {
            type: 'value',
            gridIndex: 1,
            scale: true,
            axisLabel: { show: false },
            splitLine: { show: false },
            axisLine: { show: false },
          },
        ],
        dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }],
        series: [
          {
            type: 'candlestick',
            xAxisIndex: 0,
            yAxisIndex: 0,
            data: candles.map((c) => [toMs(c.time), c.open, c.close, c.low, c.high]),
            itemStyle: {
              color: '#16c784',
              color0: '#ea3943',
              borderColor: '#16c784',
              borderColor0: '#ea3943',
            },
          },
          {
            type: 'bar',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: candles.map((c) => ({
              value: [toMs(c.time), c.volume ?? Math.abs(c.close - c.open) * 1000],
              itemStyle: {
                color: c.close >= c.open ? 'rgba(22,199,132,0.35)' : 'rgba(234,57,67,0.35)',
              },
            })),
            barWidth: '60%',
          },
        ],
      },
      { notMerge: true },
    )
  }, [bundle])

  if (isLoading && !bundle) return <PanelSkeleton rows={6} />
  if (isError || !bundle) return <EmptyState message="Execution chart offline — price feed unavailable." />

  return (
    <div className="ex-chart-wrap">
      <div className="ex-chart-meta">
        <span className="ex-chart-sym">${bundle.token.symbol}</span>
        <span className="ex-chart-px">${bundle.token.priceUsd.toPrecision(6)}</span>
        <span className={bundle.token.change24hPct >= 0 ? 'ex-pos' : 'ex-neg'}>
          {bundle.token.change24hPct >= 0 ? '+' : ''}
          {bundle.token.change24hPct.toFixed(2)}%
        </span>
      </div>
      <div ref={hostRef} className="ex-chart-canvas" />
      <p className="ex-chart-note">Execution instrument — price context only. Intelligence overlays live on Intelligence Chart.</p>
    </div>
  )
}
