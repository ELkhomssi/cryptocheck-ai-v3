import type { ReactNode } from 'react'

type GlassCardProps = {
  children: ReactNode
  className?: string
  /** Stronger accent for active / highlighted surfaces */
  accent?: 'default' | 'sentinel'
}

export function GlassCard({ children, className = '', accent = 'default' }: GlassCardProps) {
  const ring =
    accent === 'sentinel'
      ? 'from-emerald-400/25 via-cyan-400/15 to-transparent'
      : 'from-white/[0.12] via-white/[0.05] to-transparent'

  return (
    <div
      className={`group relative rounded-xl p-px bg-gradient-to-br ${ring} transition-transform duration-200 ease-out hover:-translate-y-0.5`}
    >
      <div
        className={`rounded-[11px] bg-[rgba(10,10,11,0.72)] backdrop-blur-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[box-shadow,transform] duration-200 ease-out group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.52),0_0_28px_rgba(59,130,246,0.08)] ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
