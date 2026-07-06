export type SkeletonBlockProps = {
  className?: string
}

export function SkeletonBlock({ className = 'h-4 w-full' }: SkeletonBlockProps) {
  return (
    <div
      className={`animate-shimmer rounded bg-dash-panel2 bg-[length:200%_100%] bg-gradient-to-r from-dash-panel2 via-dash-greenDim to-dash-panel2 ${className}`}
      aria-hidden
    />
  )
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
