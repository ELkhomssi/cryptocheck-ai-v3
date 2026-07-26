'use client'

/**
 * Brass performance ring — var(--pd-accent). Calibrating = gray dashed segment, no %.
 */

export function PerformanceRing({
  score,
  calibrating,
  size = 52,
}: {
  score: number | null
  calibrating: boolean
  size?: number
}) {
  const stroke = 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const showPct = !calibrating && score != null && Number.isFinite(score)
  const pct = showPct ? Math.max(0, Math.min(100, score)) : 0
  const dash = showPct ? (pct / 100) * c : c * 0.12
  const color = showPct ? 'var(--pd-accent)' : 'var(--pd-border)'
  const dashArray = showPct ? `${dash} ${c - dash}` : `${dash} ${c - dash}`

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
      }}
      title={
        showPct
          ? `Performance ${Math.round(pct)}%`
          : 'Calibrating — not enough resolved samples yet'
      }
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--pd-border-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={dashArray}
          strokeLinecap={showPct ? 'round' : 'butt'}
          strokeDashoffset={showPct ? 0 : c * 0.05}
          style={showPct ? undefined : { strokeDasharray: `${dash} 6` }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'var(--font-ibm-plex-mono), monospace',
          fontSize: showPct ? 12 : 8,
          fontWeight: 600,
          color: showPct ? 'var(--pd-text)' : 'var(--pd-text-faint)',
          lineHeight: 1.1,
          textAlign: 'center',
          padding: 4,
        }}
      >
        {showPct ? (
          <>{Math.round(pct)}%</>
        ) : (
          <span style={{ letterSpacing: '0.02em' }}>Cal</span>
        )}
      </div>
    </div>
  )
}
