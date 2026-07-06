export type FactorRowProps = {
  name: string
  meterLevel: number
  word: string
  tone?: 'good' | 'mid' | 'bad'
}

export function FactorRow({ name, meterLevel, word, tone = 'good' }: FactorRowProps) {
  const wordColor =
    tone === 'good' ? 'text-dash-green' : tone === 'mid' ? 'text-dash-amber' : 'text-dash-red'

  return (
    <div className="flex items-center gap-2 py-1.5 text-xs" aria-label={`${name}: ${word}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dash-green" />
      <span className="shrink-0 text-[12px] text-dash-tmid">{name}</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-dash-innerline" aria-hidden />
      <span className={`shrink-0 text-[12px] font-medium ${wordColor}`}>{word}</span>
    </div>
  )
}
