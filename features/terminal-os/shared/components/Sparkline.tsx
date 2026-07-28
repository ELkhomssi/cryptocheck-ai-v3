'use client'

/** Axis-free sparkline colored by trend direction */
export function Sparkline({
  values,
  width = 72,
  height = 28,
  positive,
}: {
  values: number[]
  width?: number
  height?: number
  positive?: boolean
}) {
  if (!values.length) {
    return <div className="tos-skeleton" style={{ width, height }} />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * width
      const y = height - ((v - min) / span) * (height - 2) - 1
      return `${x},${y}`
    })
    .join(' ')
  const up = positive ?? values[values.length - 1]! >= values[0]!
  const stroke = up ? 'var(--tos-positive)' : 'var(--tos-negative)'

  return (
    <svg width={width} height={height} aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={2.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  )
}
