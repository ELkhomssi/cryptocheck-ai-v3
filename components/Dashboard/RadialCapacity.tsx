type RadialCapacityProps = {
  used: number
  limit: number
  /** Omit when parent panel already titles the widget */
  label?: string
  sublabel?: string
  /** Unique SVG defs id prefix — avoids clashes when multiple gauges mount */
  chartId?: string
}

export function RadialCapacity({ used, limit, label = '', sublabel, chartId = 'cap' }: RadialCapacityProps) {
  const pct = Math.min(100, (used / Math.max(1, limit)) * 100)
  const r = 44
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  const dashOffset = c - dash
  const uid = `${chartId}-${used}-${limit}`.replace(/[^a-zA-Z0-9_-]/g, '_')

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-2">
      <div className="relative h-[120px] w-[120px]">
        <svg className="-rotate-90 drop-shadow-[0_0_14px_rgba(6,182,212,0.45)]" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.95" />
              <stop offset="50%" stopColor="rgb(6, 182, 212)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="rgb(244, 114, 182)" stopOpacity="0.55" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={`url(#${uid}-fill)`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            filter={`url(#${uid}-glow)`}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono-terminal font-semibold tabular-nums tracking-tight text-cyan-100"
            style={{ fontSize: '1.35rem' }}
          >
            {Math.round(pct)}%
          </span>
          <span className="font-mono-terminal text-[0.65rem] font-medium uppercase tracking-[0.2em] text-cyan-200/60">
            utilized
          </span>
        </div>
      </div>
      {(label.trim() || sublabel) && (
        <div className="text-center">
          {label.trim() ? (
            <p className="font-space text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">{label}</p>
          ) : null}
          {sublabel && (
            <p className={`font-mono-terminal tabular-nums text-xs font-medium text-slate-300 ${label.trim() ? 'mt-1' : ''}`}>
              {used.toLocaleString()} <span className="text-cyan-500/50">/</span> {limit.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
