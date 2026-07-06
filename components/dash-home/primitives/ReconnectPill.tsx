export function ReconnectPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-dash-pill border border-dash-amber/30 bg-dash-amber/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-dash-amber">
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-dash-amber" />
      Reconnecting…
    </span>
  )
}
