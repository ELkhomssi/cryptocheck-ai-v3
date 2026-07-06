'use client'

import type { LucideIcon } from 'lucide-react'
import { Radio } from 'lucide-react'

type Props = {
  title: string
  detail: string
  icon?: LucideIcon
  className?: string
}

export function EmptyState({ title, detail, icon: Icon = Radio, className = '' }: Props) {
  return (
    <div
      className={`rd-panel flex min-h-[12rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <Icon className="h-5 w-5 text-rd-lo" aria-hidden strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.14em] text-rd-hi">
          {title}
        </p>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-rd-mid">{detail}</p>
      </div>
    </div>
  )
}
