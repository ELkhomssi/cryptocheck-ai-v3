'use client'

type Props = {
  filled: number
  total?: number
  label: string
  status: string
}

export function DotMeter({ filled, total = 5, label, status }: Props) {
  const safe = Math.max(0, Math.min(total, filled))
  return (
    <div className="flex items-center justify-between gap-3 py-1.5" aria-label={`${label}: ${status}`}>
      <span className="cc-label min-w-0 flex-1 truncate text-[0.55rem] text-[var(--cc-mid)]">{label}</span>
      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < safe ? 'bg-[var(--cc-green)] shadow-[0_0_6px_rgba(123,232,75,0.5)]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <span className="cc-mono w-14 text-right text-[0.62rem] text-[var(--cc-hi)]">{status}</span>
    </div>
  )
}
