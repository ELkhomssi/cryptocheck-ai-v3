'use client'

export function SignalBadge({ verdict }: { verdict: string }) {
  const v = verdict.toLowerCase()
  const tone = v.includes('bullish')
    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
    : v.includes('caution') || v.includes('bearish') || v.includes('exit')
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-slate-500/30 bg-slate-500/10 text-slate-300'
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${tone}`}>
      {verdict}
    </span>
  )
}
