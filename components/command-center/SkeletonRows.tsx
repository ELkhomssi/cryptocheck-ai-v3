'use client'

type Props = {
  rows?: number
  className?: string
}

export function SkeletonRows({ rows = 6, className = '' }: Props) {
  return (
    <div className={`rd-panel overflow-hidden ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-white/[0.04] px-3 py-3 last:border-0"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="h-3 w-2/5 max-w-[10rem] rounded bg-white/[0.06] motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
            <div
              className="h-2.5 w-4/5 max-w-[18rem] rounded bg-white/[0.04] motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 80 + 40}ms` }}
            />
          </div>
          <div
            className="h-7 w-16 shrink-0 rounded bg-white/[0.05] motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 80 + 20}ms` }}
          />
          <div
            className="h-8 w-20 shrink-0 rounded bg-white/[0.05] motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 80 + 60}ms` }}
          />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-rd-sm border border-white/10 bg-rd-navy/50 px-3 py-3"
        >
          <div className="h-2 w-12 rounded bg-white/[0.06] motion-safe:animate-pulse" />
          <div
            className="mt-2 h-6 w-16 rounded bg-white/[0.08] motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        </div>
      ))}
    </div>
  )
}
