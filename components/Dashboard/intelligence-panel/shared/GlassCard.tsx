'use client'

import { type ReactNode } from 'react'

/**
 * Intelligence / Analysis Console panel shell — neon triad border, Space Grotesk header,
 * JetBrains mono for badge line. Matches AI Investigation Agent DNA.
 */
export function GlassCard({
  title,
  badge,
  children,
  className = '',
}: {
  title: string
  badge?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`
      relative rounded-2xl bg-gradient-to-br from-cyan-500/45 via-fuchsia-500/40 to-emerald-500/45 p-px
      shadow-[0_0_32px_rgba(34,211,238,0.08),0_0_48px_rgba(168,85,247,0.05)]
      motion-safe:animate-neon-pulse
      ${className}
    `}
    >
      <div
        className="
        relative overflow-hidden rounded-2xl border border-white/[0.06]
        bg-slate-950/85 backdrop-blur-xl
      "
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(34,211,238,0.08),transparent_50%),radial-gradient(ellipse_at_100%_0%,rgba(168,85,247,0.07),transparent_45%),radial-gradient(ellipse_at_50%_100%,rgba(16,185,129,0.06),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 sm:px-5">
          <h3 className="font-space text-sm font-bold uppercase tracking-[0.18em] text-slate-100 sm:text-base">
            <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-emerald-200 bg-clip-text text-transparent">
              {title}
            </span>
          </h3>
          {badge ? (
            <span
              className="
              inline-flex items-center rounded-full border border-cyan-400/25
              bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/15 to-emerald-500/20
              px-3 py-1 font-mono-terminal text-xs font-semibold uppercase tracking-wider text-cyan-100/90
            "
            >
              {badge}
            </span>
          ) : null}
        </div>
        <div className="relative p-4 text-sm leading-relaxed text-slate-200 sm:p-5 sm:text-[0.9375rem]">
          {children}
        </div>
      </div>
    </div>
  )
}
