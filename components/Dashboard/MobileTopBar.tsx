'use client'

import { Menu } from 'lucide-react'

export function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-12 min-h-[48px] w-12 min-w-[48px] shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-200 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050506] md:hidden"
      onClick={() => {
        if (typeof navigator !== 'undefined') navigator.vibrate?.(8)
        onOpenMenu()
      }}
      aria-label="Open navigation menu"
    >
      <Menu className="h-6 w-6" strokeWidth={1.5} aria-hidden />
    </button>
  )
}
