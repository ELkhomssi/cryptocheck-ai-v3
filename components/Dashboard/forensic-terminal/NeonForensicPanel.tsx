import type { ReactNode } from 'react'

type NeonForensicPanelProps = {
  title: string
  subtitle?: string
  /** Threat stream — amber/red bias; capacity — cyan/emerald */
  tone?: 'neutral' | 'threat' | 'capacity'
  className?: string
  headerClassName?: string
  children: ReactNode
}

const toneRing: Record<NonNullable<NeonForensicPanelProps['tone']>, string> = {
  neutral:
    'from-cyan-400/55 via-fuchsia-400/35 to-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.12)] hover:shadow-[0_0_32px_rgba(6,182,212,0.22)]',
  threat:
    'from-amber-400/65 via-rose-500/50 to-amber-500/60 shadow-[0_0_22px_rgba(251,191,36,0.16)] hover:shadow-[0_0_36px_rgba(248,113,113,0.22)]',
  capacity:
    'from-cyan-400/50 via-emerald-400/45 to-cyan-500/55 shadow-[0_0_20px_rgba(6,182,212,0.14)] hover:shadow-[0_0_34px_rgba(52,211,153,0.2)]',
}

/**
 * Glassmorphism + animated neon border + hover lift (forensic command center).
 */
export function NeonForensicPanel({
  title,
  subtitle,
  tone = 'neutral',
  className = '',
  headerClassName = '',
  children,
}: NeonForensicPanelProps) {
  const ring = toneRing[tone]

  return (
    <div
      className={`group/panel relative rounded-2xl bg-gradient-to-br bg-[length:200%_200%] p-px transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 ${ring} ${className}`}
    >
      <div className="motion-safe:animate-neon-pulse motion-reduce:animate-none rounded-[15px] border border-white/[0.07] bg-black/50 backdrop-blur-xl transition-[transform,box-shadow] duration-300 group-hover/panel:-translate-y-0.5 group-hover/panel:shadow-[0_0_36px_rgba(6,182,212,0.18)]">
        <div className={`border-b border-cyan-500/10 px-5 py-3.5 ${headerClassName}`}>
          <p className="font-space text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">{title}</p>
          {subtitle ? (
            <p className="mt-1 font-mono-terminal text-[0.65rem] font-medium leading-relaxed text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        <div className="px-4 pb-5 pt-3">{children}</div>
      </div>
    </div>
  )
}
