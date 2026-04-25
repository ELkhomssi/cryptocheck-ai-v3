import type { ReactNode } from 'react'

type GlassCardProps = {
  children: ReactNode
  className?: string
  /** Ring accent — matches {@link NeonForensicPanel} tones */
  accent?: 'default' | 'sentinel' | 'threat' | 'capacity'
}

const accentRing: Record<NonNullable<GlassCardProps['accent']>, string> = {
  default:
    'from-cyan-400/50 via-fuchsia-400/35 to-emerald-400/48 shadow-[0_0_18px_rgba(34,211,238,0.1)] hover:shadow-[0_0_28px_rgba(168,85,247,0.14)]',
  sentinel:
    'from-emerald-400/50 via-cyan-400/4 to-emerald-500/50 shadow-[0_0_18px_rgba(16,185,129,0.14)] hover:shadow-[0_0_30px_rgba(52,211,153,0.2)]',
  threat:
    'from-amber-400/55 via-rose-500/45 to-amber-500/50 shadow-[0_0_20px_rgba(251,191,36,0.12)]',
  capacity:
    'from-cyan-400/50 via-emerald-400/42 to-cyan-500/52 shadow-[0_0_18px_rgba(6,182,212,0.12)]',
}

/**
 * Headerless neon forensic surface — same DNA as {@link NeonForensicPanel} for flexible layouts.
 */
export function GlassCard({ children, className = '', accent = 'default' }: GlassCardProps) {
  const ring = accentRing[accent]

  return (
    <div
      className={`group relative rounded-2xl bg-gradient-to-br bg-[length:200%_200%] p-px transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 motion-safe:animate-neon-pulse motion-reduce:animate-none ${ring}`}
    >
      <div
        className={`rounded-[15px] border border-white/[0.07] bg-black/50 backdrop-blur-xl transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_32px_rgba(6,182,212,0.14)] ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
