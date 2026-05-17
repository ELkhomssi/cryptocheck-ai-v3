'use client'

import { memo, useMemo, type ReactNode } from 'react'
import { fmt } from '../terminal-utils'
import type { Candle } from '../terminal-types'

export const CandlestickChart = memo(function CandlestickChart({
  candles,
  width = 720,
  height = 320,
}: {
  candles: Candle[]
  width?: number
  height?: number
}) {
  const { min, max, paths, areaPath, lastX, lastY, lastBull } = useMemo(() => {
    if (!candles.length) {
      return {
        min: 0,
        max: 1,
        paths: [] as ReactNode[],
        areaPath: '',
        lastX: 0,
        lastY: 0,
        lastBull: true,
      }
    }
    const lows = candles.map((c) => c.l)
    const highs = candles.map((c) => c.h)
    const minP = Math.min(...lows) * 0.998
    const maxP = Math.max(...highs) * 1.002
    const range = maxP - minP || 1
    const pad = 16
    const cw = (width - pad * 2) / candles.length
    const bodyW = Math.max(2, cw * 0.52)
    const y = (p: number) => pad + ((maxP - p) / range) * (height - pad * 2)

    const pts = candles.map((c, i) => {
      const x = pad + i * cw + cw / 2
      return { x, y: y(c.c) }
    })
    const areaPath = [
      `M ${pts[0].x} ${height - pad}`,
      ...pts.map((p) => `L ${p.x} ${p.y}`),
      `L ${pts[pts.length - 1].x} ${height - pad}`,
      'Z',
    ].join(' ')

    const last = candles[candles.length - 1]
    const lastBull = last.c >= last.o
    const lastX = pts[pts.length - 1].x
    const lastY = pts[pts.length - 1].y

    const elements = candles.map((c, i) => {
      const x = pad + i * cw + cw / 2
      const bullish = c.c >= c.o
      const color = bullish ? '#4ade80' : '#f87171'
      const glow = bullish ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.35)'
      const bodyTop = y(Math.max(c.o, c.c))
      const bodyBot = y(Math.min(c.o, c.c))
      const bodyH = Math.max(1, bodyBot - bodyTop)
      const isLast = i === candles.length - 1
      return (
        <g key={i}>
          <line
            x1={x}
            y1={y(c.h)}
            x2={x}
            y2={y(c.l)}
            stroke={color}
            strokeWidth={1}
            opacity={0.85}
          />
          <rect
            x={x - bodyW / 2}
            y={bodyTop}
            width={bodyW}
            height={bodyH}
            fill={color}
            rx={1}
            filter={isLast ? `drop-shadow(0 0 6px ${glow})` : undefined}
          />
        </g>
      )
    })

    return { min: minP, max: maxP, paths: elements, areaPath, lastX, lastY, lastBull }
  }, [candles, width, height])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Chart ${fmt(min, 8)} – ${fmt(max, 8)} SOL`}
    >
      <defs>
        <linearGradient id="web4-area-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="web4-area-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
        </linearGradient>
      </defs>
      {Array.from({ length: 6 }).map((_, i) => {
        const yy = 16 + (i / 5) * (height - 32)
        return (
          <line key={i} x1={16} y1={yy} x2={width - 16} y2={yy} stroke="rgba(255,255,255,0.04)" />
        )
      })}
      {areaPath ? (
        <path d={areaPath} fill={lastBull ? 'url(#web4-area-up)' : 'url(#web4-area-down)'} />
      ) : null}
      {paths}
      {candles.length > 0 ? (
        <circle
          cx={lastX}
          cy={lastY}
          r={4}
          fill={lastBull ? '#86efac' : '#f87171'}
          className="animate-pulse"
        />
      ) : null}
    </svg>
  )
})
