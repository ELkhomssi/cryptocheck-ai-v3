type RadialCapacityProps = {
  used: number
  limit: number
  label: string
  sublabel?: string
}

export function RadialCapacity({ used, limit, label, sublabel }: RadialCapacityProps) {
  const pct = Math.min(100, (used / Math.max(1, limit)) * 100)
  const r = 44
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  const dashOffset = c - dash

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-2">
      <div className="relative h-[120px] w-[120px]">
        <svg className="-rotate-90" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
          <defs>
            <linearGradient id="cap-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="0.75" />
            </linearGradient>
            <filter id="cap-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="url(#cap-fill)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            filter="url(#cap-glow)"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-semibold tabular-nums text-slate-200 tracking-tight" style={{ fontSize: '1.35rem' }}>
            {Math.round(pct)}%
          </span>
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">utilized</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
        {sublabel && (
          <p className="mt-1 tabular-nums text-xs font-medium text-slate-400">
            {used.toLocaleString()} <span className="text-slate-600">/</span> {limit.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
