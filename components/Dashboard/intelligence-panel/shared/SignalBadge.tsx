'use client'

export function SignalBadge({ verdict }: { verdict?: string | null }) {
  const safe = verdict?.trim() || 'PENDING'
  const v = safe.toLowerCase()
  const isBull = v.includes('bullish')
  const isCaution = v.includes('caution') || v.includes('bearish') || v.includes('exit')
  const gradient = isBull
    ? 'from-cyan-500/25 via-emerald-500/20 to-cyan-400/25 border-cyan-400/35 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
    : isCaution
      ? 'from-amber-500/25 via-rose-500/15 to-amber-400/20 border-amber-400/35 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
      : 'from-slate-600/30 via-fuchsia-900/20 to-slate-600/30 border-slate-500/35 text-slate-200'

  return (
    <span
      className={`
      inline-flex rounded-full border bg-gradient-to-r px-4 py-1.5
      font-space text-sm font-bold uppercase tracking-widest
      ${gradient}
    `}
    >
      {safe}
    </span>
  )
}
