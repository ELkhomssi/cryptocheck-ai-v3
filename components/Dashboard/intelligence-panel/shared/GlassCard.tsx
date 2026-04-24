'use client'
import { type ReactNode } from 'react'

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
      relative rounded-lg border border-cyan-500/20
      bg-slate-900/60 backdrop-blur-sm
      shadow-[0_0_20px_rgba(0,212,170,0.05)]
      ${className}
    `}
    >
      <div className="flex items-center justify-between border-b border-cyan-500/10 px-4 py-2">
        <span className="font-mono text-xs tracking-wider text-cyan-400">// {title}</span>
        {badge && (
          <span className="rounded border border-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-300/70">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
