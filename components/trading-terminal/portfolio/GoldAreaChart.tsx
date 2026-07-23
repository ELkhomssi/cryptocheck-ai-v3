'use client'

/** Gold area chart matching picture-1 mock — built from live close prices. */
export function GoldAreaChart({
  values,
  height = 150,
}: {
  values: number[]
  height?: number
}) {
  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[12px] text-[var(--tit-text-2)]"
        style={{ height }}
      >
        Live series loading…
      </div>
    )
  }

  const w = 900
  const h = height
  const padY = 8
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = padY + (1 - (v - min) / span) * (h - padY * 2)
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const fill = `${line} L${w},${h} L0,${h} Z`

  return (
    <svg
      className="tit-port-hero-chart-svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id="titHeroFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A9782E" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#C9A05A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#titHeroFill)" />
      <path d={line} fill="none" stroke="#B8863E" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
